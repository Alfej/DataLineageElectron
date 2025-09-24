import { openDB, IDBPDatabase } from 'idb';

export type FiltersState = { [key: string]: string[] };

export type GraphHistoryEntry = {
  positions: Record<string, { x: number; y: number }>;
  hidden: string[];
  filters: FiltersState;
  layoutDirection: string;
  neighborhoodNodes: string[];
  selectedNeighborhoodNodes?: string[]; // User's original selection before expansion
  timestamp: number;
  _sig?: string; // internal hash signature for dedupe
};

type GraphHistory = {
  entries: GraphHistoryEntry[];
  index: number; // points to current entry (last valid state)
};

const DB_NAME = 'GraphDB';
const STORE = 'history';

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, { // Increment version to handle existing databases
      upgrade(db) {
        // Handle version upgrades gracefully
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
        // If upgrading from version 1 to 2, we can add any new indices or stores here if needed
      },
    });
  }
  return dbPromise;
}

function keyFor(fileKey?: string | null) {
  return fileKey ? `graph_history::${fileKey}` : 'graph_history';
}

export async function loadHistory(fileKey?: string | null): Promise<GraphHistory | null> {
  const db = await getDB();
  const data = await db.get(STORE, keyFor(fileKey));
  return (data as GraphHistory) || null;
}

export async function saveHistory(fileKey: string | null | undefined, hist: GraphHistory) {
  const db = await getDB();
  await db.put(STORE, hist, keyFor(fileKey));
}

export async function hasHistory(fileKey?: string | null): Promise<boolean> {
  const h = await loadHistory(fileKey);
  return !!(h && h.entries && h.entries.length > 0);
}

export async function ensureInitial(fileKey: string | null | undefined, entry: GraphHistoryEntry) {
  const h = await loadHistory(fileKey);
  if (!h || h.entries.length === 0) {
    await saveHistory(fileKey, { entries: [entry], index: 0 });
  }
}

export async function pushHistory(
  fileKey: string | null | undefined,
  entry: GraphHistoryEntry,
  limit: number = 20
) {
  let h = await loadHistory(fileKey);
  if (!h) h = { entries: [], index: -1 };

  // If we are not at the end (redo branch exists), cut the tail
  if (h.index >= 0 && h.index < h.entries.length - 1) {
    h.entries = h.entries.slice(0, h.index + 1);
  }

  // build a compact signature: counts + first 20 node coords + hidden length + filter keys + layoutDirection + neighborhood
  const buildSig = (e: GraphHistoryEntry) => {
    const posKeys = Object.keys(e.positions).sort();
    const head = posKeys.slice(0, 20).map(k => {
      const p = e.positions[k];
      return `${k}:${Math.round(p.x)}:${Math.round(p.y)}`; // coarse rounding for stability
    }).join('|');
    const hiddenSize = e.hidden.length;
    const filterSig = Object.keys(e.filters).sort().map(k => `${k}:${(e.filters[k]||[]).length}`).join(',');
    const neighborhoodSig = (e.neighborhoodNodes || []).sort().join(',');
    return `${posKeys.length}|${hiddenSize}|${filterSig}|${e.layoutDirection}|${neighborhoodSig}|${head}`;
  };
  entry._sig = buildSig(entry);

  const last = h.entries[h.entries.length - 1];
  if (last && last._sig === entry._sig) {
    // ignore exact duplicate snapshot
    return;
  }

  // Optionally skip if only tiny jitter in positions (sum delta < 2 px overall)
  if (last) {
    let delta = 0;
    const keys = new Set([...Object.keys(entry.positions), ...Object.keys(last.positions)]);
    for (const k of keys) {
      const a = entry.positions[k];
      const b = last.positions[k];
      if (a && b) delta += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
    if (delta < 2 && entry.layoutDirection === last.layoutDirection && 
        entry.hidden.length === last.hidden.length &&
        JSON.stringify((entry.neighborhoodNodes || []).sort()) === JSON.stringify((last.neighborhoodNodes || []).sort())) {
      return; // skip near-no-op move
    }
  }

  h.entries.push(entry);

  // Trim from the front if exceeding limit
  while (h.entries.length > limit) {
    h.entries.shift();
  }

  h.index = h.entries.length - 1; // current points to the newest state
  // buffered write (simple micro-task queue) to collapse rapid pushes
  schedulePersist(fileKey, h);
}

export async function undo(fileKey: string | null | undefined): Promise<GraphHistoryEntry | null> {
  const h = await loadHistory(fileKey);
  if (!h || h.entries.length === 0 || h.index <= 0) return null;

  let resultIndex = h.index - 1;
  // Move pointer back to enable redo (don't delete entries)
  h.index = Math.max(0, h.index - 1);
  await saveHistory(fileKey, h);
  return h.entries[resultIndex] || null;
}

export async function canUndo(fileKey: string | null | undefined): Promise<boolean> {
  const h = await loadHistory(fileKey);
  return !!(h && h.entries.length > 1 && h.index > 0);
}

export async function redo(fileKey: string | null | undefined): Promise<GraphHistoryEntry | null> {
  const h = await loadHistory(fileKey);
  if (!h || h.entries.length === 0 || h.index >= h.entries.length - 1) return null;
  h.index = Math.min(h.entries.length - 1, h.index + 1);
  await saveHistory(fileKey, h);
  return h.entries[h.index] || null;
}

export async function canRedo(fileKey: string | null | undefined): Promise<boolean> {
  const h = await loadHistory(fileKey);
  return !!(h && h.entries.length > 1 && h.index < h.entries.length - 1);
}

// --- Buffered persist implementation ---
type Pending = { timeout: any; hist: GraphHistory };
const pendingMap = new Map<string, Pending>();

function schedulePersist(fileKey: string | null | undefined, hist: GraphHistory) {
  const k = fileKey ? String(fileKey) : '__default__';
  const existing = pendingMap.get(k);
  if (existing) {
    existing.hist = hist; // replace with newest
    return;
  }
  const timeout = setTimeout(async () => {
    const p = pendingMap.get(k);
    if (p) {
      try { await saveHistory(fileKey, p.hist); } catch {}
      pendingMap.delete(k);
    }
  }, 120); // 120ms buffer window
  pendingMap.set(k, { timeout, hist });
}
