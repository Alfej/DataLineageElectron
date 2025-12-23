// Utilities to manage type -> color mappings persisted in localStorage

const TABLE_KEY = 'global_table_type_colors';
const REL_KEY = 'global_relationship_type_colors';

const brightColors = [
  '#8BC34A', // light green
  '#F44336', // red
  '#9C27B0', // purple
  '#3F51B5', // indigo
  '#03A9F4', // light blue
  '#009688', // teal
  '#CDDC39', // lime
  '#FFC107', // amber
  '#FF9800', // orange
  '#FF5722', // deep orange
  '#795548', // brown
  '#607D8B', // blue grey
];

const pickColor = (used: Set<string>) => {
  // pick an unused bright color first
  for (const c of brightColors) {
    if (!used.has(c)) return c;
  }
  // fallback: random bright color
  const rand = () => Math.floor(Math.random() * 200) + 30;
  return `rgb(${rand()},${rand()},${rand()})`;
};

function loadMap(kind: 'table' | 'relationship'): Record<string, string> {
  try {
    const raw = localStorage.getItem(kind === 'table' ? TABLE_KEY : REL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMap(kind: 'table' | 'relationship', map: Record<string, string>) {
  try {
    localStorage.setItem(kind === 'table' ? TABLE_KEY : REL_KEY, JSON.stringify(map));
  } catch {}
}

export function getColorFor(kind: 'table' | 'relationship', type: string | undefined) {
  if (!type) return undefined;
  const map = loadMap(kind);
  return map[type];
}

export function registerTypesFromData(rows: any[]) {
  if (!rows || !rows.length) return;
  const tableMap = loadMap('table');
  const relMap = loadMap('relationship');
  const used = new Set(Object.values(tableMap).concat(Object.values(relMap)));

  // collect unique table types and relationship
  const tableTypes = new Set<string>();
  const relTypes = new Set<string>();
  for (const r of rows) {
    if (r.parentTableType) tableTypes.add(String(r.parentTableType));
    if (r.childTableType) tableTypes.add(String(r.childTableType));
    if (r.relationship) relTypes.add(String(r.relationship));
  }

  let changed = false;
  for (const t of tableTypes) {
    if (!tableMap[t]) {
      tableMap[t] = pickColor(used);
      used.add(tableMap[t]);
      changed = true;
    }
  }
  for (const rType of relTypes) {
    if (!relMap[rType]) {
      relMap[rType] = pickColor(used);
      used.add(relMap[rType]);
      changed = true;
    }
  }

  if (changed) {
    saveMap('table', tableMap);
    saveMap('relationship', relMap);
  }
}

export function getAllTypeMaps() {
  return {
    table: loadMap('table'),
    relationship: loadMap('relationship'),
  };
}

export function setColorFor(_kind: 'table' | 'relationship', type: string, _color: string) {
  if (!type) return;
  // Intentionally do nothing: color picker UI retained but persistence disabled per request
  return;
}

export function clearAllTypeMaps() {
  try {
    localStorage.removeItem(TABLE_KEY);
    localStorage.removeItem(REL_KEY);
  } catch {}
}
