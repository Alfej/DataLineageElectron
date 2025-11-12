/**
 * Hierarchical Parser - Transforms CSV data into hierarchical tree structure
 * Structure: HierarchyLevel -> Value -> NodeDetails
 */

import { 
  HierarchicalDataStructure,
  HierarchyLevel, 
  NodeDetails,
  ChildReferences
} from '../types/nodeModel';

export interface CSVRow {
  ParentSector: string;
  ParentApplication: string;
  ParentPurpose: string;
  ParentClient: string;
  ParentTool: string;
  ParentSystem: string;
  ParentSchema: string;
  ParentObjectName: string;
  
  ChildSector: string;
  ChildApplication: string;
  ChildPurpose: string;
  ChildClient: string;
  ChildTool: string;
  ChildSystem: string;
  ChildSchema: string;
  ChildObjectName: string;
  
  InternalRelationship: string;
  
  [key: string]: string;
}

const HIERARCHY_LEVELS: HierarchyLevel[] = [
  "Sector",
  "Application",
  "Purpose",
  "Client",
  "Tool",
  "System",
  "Schema",
  "ObjectName"
];

/**
 * Build hierarchical data structure from CSV rows
 * Organizes data as: Level -> Value -> Details
 */
export function buildHierarchicalStructure(csvRows: Record<string, unknown>[]): HierarchicalDataStructure {
  const structure: HierarchicalDataStructure = {
    Sector: {},
    Application: {},
    Purpose: {},
    Client: {},
    Tool: {},
    System: {},
    Schema: {},
    ObjectName: {}
  };
  
  csvRows.forEach((row) => {
    const csvRow = row as unknown as CSVRow;
    
    // Process only Parent side to record Parent -> Child relationships
    processHierarchyValues(structure, csvRow, 'Parent');
  });
  
  return structure;
}

/**
 * Process all hierarchy levels for parent or child side
 */
function processHierarchyValues(
  structure: HierarchicalDataStructure,
  csvRow: CSVRow,
  side: 'Parent' | 'Child'
): void {
  HIERARCHY_LEVELS.forEach((level) => {
    const value = csvRow[`${side}${level}`];
    
    if (!value || value.trim() === '') return;
    
    // Initialize node details if not exists
    if (!structure[level][value]) {
      structure[level][value] = {
        Childs: {},
        Position: { x: 0, y: 0 },
        FilteredOut: false,
        Hidden: false
      };
    }
    
    const nodeDetails = structure[level][value];
    
    // Add child references
    addChildReferences(nodeDetails.Childs, csvRow, side);
  });
}

/**
 * Add child references from CSV row to the Childs object
 */
function addChildReferences(
  childs: ChildReferences,
  csvRow: CSVRow,
  side: 'Parent' | 'Child'
): void {
  // We only record Parent -> Child relationships
  if (side !== 'Parent') return;

  HIERARCHY_LEVELS.forEach((level) => {
    const childValue = csvRow[`Child${level}`];
    if (!childValue || childValue.trim() === '') return;

    // Initialize map for this hierarchy level if not exists
    if (!childs[level]) {
      childs[level] = {};
    }

    const mapForLevel = childs[level] as Record<string, string[]>;

    // Initialize relationship array for this child value
    if (!mapForLevel[childValue]) {
      mapForLevel[childValue] = [];
    }

    // Add relationship specific to this parent->child pair
    const rel = csvRow.InternalRelationship;
    if (rel && !mapForLevel[childValue].includes(rel)) {
      mapForLevel[childValue].push(rel);
    }
  });
}

/**
 * Get all unique values at a specific hierarchy level
 */
export function getValuesAtLevel(
  structure: HierarchicalDataStructure,
  level: HierarchyLevel
): string[] {
  return Object.keys(structure[level]);
}

/**
 * Get node details for a specific value at a hierarchy level
 */
export function getNodeDetails(
  structure: HierarchicalDataStructure,
  level: HierarchyLevel,
  value: string
): NodeDetails | undefined {
  return structure[level][value];
}

/**
 * Get all children of a specific node across all hierarchy levels
 */
export function getAllChildren(
  structure: HierarchicalDataStructure,
  level: HierarchyLevel,
  value: string
): { level: HierarchyLevel; values: string[] }[] {
  const nodeDetails = structure[level][value];
  if (!nodeDetails) return [];
  
  const children: { level: HierarchyLevel; values: string[] }[] = [];
  
  HIERARCHY_LEVELS.forEach((childLevel) => {
    const refs = nodeDetails.Childs[childLevel] as Record<string, string[]> | undefined;
    if (refs && Object.keys(refs).length > 0) {
      children.push({ level: childLevel, values: Object.keys(refs) });
    }
  });
  
  return children;
}

/**
 * Update node details for a specific value
 */
export function updateNodeDetails(
  structure: HierarchicalDataStructure,
  level: HierarchyLevel,
  value: string,
  updates: Partial<NodeDetails>
): void {
  if (structure[level][value]) {
    structure[level][value] = {
      ...structure[level][value],
      ...updates
    };
  }
}

/**
 * Filter structure by hierarchy level and values
 */
export function filterByHierarchy(
  structure: HierarchicalDataStructure,
  level: HierarchyLevel,
  values: string[]
): HierarchicalDataStructure {
  const filtered: HierarchicalDataStructure = {
    Sector: {},
    Application: {},
    Purpose: {},
    Client: {},
    Tool: {},
    System: {},
    Schema: {},
    ObjectName: {}
  };
  
  // If filtering by a specific level, only include those values
  values.forEach((value) => {
    if (structure[level][value]) {
      filtered[level][value] = { ...structure[level][value] };
    }
  });
  
  // Include all related nodes from other levels
  // This is a simplified version - you may want to traverse relationships
  HIERARCHY_LEVELS.forEach((otherLevel) => {
    if (otherLevel !== level) {
      Object.keys(structure[otherLevel]).forEach((value) => {
        filtered[otherLevel][value] = { ...structure[otherLevel][value] };
      });
    }
  });
  
  return filtered;
}

/**
 * Convert structure to flat array format for debugging or export
 */
export function structureToArray(structure: HierarchicalDataStructure): Array<{
  level: HierarchyLevel;
  value: string;
  details: NodeDetails;
}> {
  const result: Array<{
    level: HierarchyLevel;
    value: string;
    details: NodeDetails;
  }> = [];
  
  HIERARCHY_LEVELS.forEach((level) => {
    Object.entries(structure[level]).forEach(([value, details]) => {
      result.push({ level, value, details });
    });
  });
  
  return result;
}

/**
 * Get statistics about the hierarchical structure
 */
export function getStructureStats(structure: HierarchicalDataStructure): {
  level: HierarchyLevel;
  uniqueValues: number;
  totalRelationships: number;
}[] {
  return HIERARCHY_LEVELS.map((level) => {
    const values = Object.values(structure[level]);
    const totalRelationships = values.reduce((sum, node) => {
      // Sum all per-child InternalRelationship entries across all child levels
      const childLevels = Object.values(node.Childs) as Array<Record<string, string[]> | undefined>;
      const levelSum = childLevels.reduce((acc, map) => {
        if (!map) return acc;
        return acc + Object.values(map).reduce((s, rels) => s + (rels?.length || 0), 0);
      }, 0);
      return sum + levelSum;
    }, 0);
    
    return {
      level,
      uniqueValues: values.length,
      totalRelationships
    };
  });
}
