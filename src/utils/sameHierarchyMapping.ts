import * as XLSX from 'xlsx';
import { HierarchyLevel } from '../types/nodeModel';

export type SameHierarchyMap = Record<string, string[]>; // key: `${fromLevel}::${toLevel}` -> relationships

let cachedMap: SameHierarchyMap | null = null;

function normalizeKey(from: string, to: string): string {
  return `${from}::${to}`;
}

export async function loadSameHierarchyMapping(url: string = './data/SameHierarchialRelationships.xlsx'): Promise<SameHierarchyMap> {
  if (cachedMap) return cachedMap;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch mapping xlsx: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Parse as matrix (array of arrays): first row headers, first column row labels
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false });
    const map: SameHierarchyMap = {};
    if (!aoa || aoa.length === 0) {
      cachedMap = map;
      return map;
    }

    const headerRow = (aoa[0] || []).map(v => String(v || '').trim());
    const colHeaders = headerRow.slice(1);
    const validLevels = new Set<HierarchyLevel>([
      'Sector','Application','Purpose','Client','Tool','System','Schema','ObjectName'
    ]);

    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] || [];
      const rowHeader = String((row[0] ?? '')).trim();
      if (!rowHeader || !validLevels.has(rowHeader as HierarchyLevel)) continue;
      const fromLevel = rowHeader as HierarchyLevel;
      for (let c = 1; c < row.length && c - 1 < colHeaders.length; c++) {
        const colHeader = String(colHeaders[c - 1] || '').trim();
        if (!colHeader || !validLevels.has(colHeader as HierarchyLevel)) continue;
        const toLevel = colHeader as HierarchyLevel;
        const cellStr = String(row[c] ?? '').trim();
        if (!cellStr) continue;
        const rels = cellStr.split(',').map(s => s.trim()).filter(Boolean);
        const key = normalizeKey(fromLevel, toLevel);
        map[key] = map[key] || [];
        for (const rel of rels) {
          if (!map[key].includes(rel)) map[key].push(rel);
        }
      }
    }

    cachedMap = map;
    return map;
  } catch (err) {
    console.error('Failed to load SameHierarchialRelationships.xlsx:', err);
    return {};
  }
}

export function getMappedRelationships(
  mapping: SameHierarchyMap,
  fromLevel: HierarchyLevel,
  toLevel: HierarchyLevel
): string[] {
  const key = normalizeKey(fromLevel, toLevel);
  return mapping[key] || [];
}
