/**
 * Graph Builder - Builds graph relationships from hierarchical structure
 * Based on FROM and TO hierarchy selections
 */

import { HierarchicalDataStructure, HierarchyLevel } from '../types/nodeModel';
import { loadSameHierarchyMapping, getMappedRelationships } from './sameHierarchyMapping';

export interface GraphRelationship {
  fromLevel: HierarchyLevel;
  fromValue: string;
  toLevel: HierarchyLevel;
  toValue: string;
  internalRelationships: string[];
}

/**
 * Build graph relationships based on FROM and TO selections
 * 
 * Algorithm:
 * 1. For each FROM value (e.g., "Finance" in Sector)
 * 2. Get the node structure and check its Childs
 * 3. Look for TO hierarchy level (e.g., "Application") in Childs
 * 4. For each TO value selected (e.g., "SalesApp")
 * 5. If found in Childs → Create relationship with InternalRelationship
 * 6. If not found → Still create nodes but without relationship
 * 
 * @param structure - The hierarchical data structure
 * @param fromLevel - The hierarchy level to start from (e.g., "Sector")
 * @param fromValues - The specific values selected at the FROM level (e.g., ["Finance", "Sales"])
 * @param toLevel - The hierarchy level to connect to (e.g., "Application")
 * @param toValues - The specific values selected at the TO level (e.g., ["SalesApp"])
 * @returns Array of graph relationships (includes both connected and unconnected nodes)
 */
export function buildGraphRelationships(
  structure: HierarchicalDataStructure,
  fromLevel: HierarchyLevel,
  fromValues: string[],
  toLevel: HierarchyLevel,
  toValues: string[]
): GraphRelationship[] {
  const relationships: GraphRelationship[] = [];

  // If no FROM or TO values selected, return empty (no graph to render)
  if (!fromValues || fromValues.length === 0 || !toValues || toValues.length === 0) {
    return [];
  }

  // For each FROM value selected (e.g., "Finance", "Sales")
  fromValues.forEach(fromValue => {
    const fromNode = structure[fromLevel][fromValue];
    
    // If FROM node doesn't exist in structure, skip
    if (!fromNode) {
      console.warn(`FROM node not found: ${fromLevel}.${fromValue}`);
      return;
    }

  // Get children at the TO level from this FROM node (map of childValue -> InternalRelationship[])
  const childrenAtToLevel = (fromNode.Childs[toLevel] || {}) as Record<string, string[]>;
  console.log(`🔍 Checking ${fromLevel}.${fromValue} for children at ${toLevel}:`, Object.keys(childrenAtToLevel));

    // For each TO value selected (e.g., "SalesApp")
    toValues.forEach(toValue => {
  // Look up the TO child entry in the children map of FROM node
  const childRelationships = childrenAtToLevel[toValue] || [];
  const isChildFound = childRelationships.length > 0;
      
      if (isChildFound) {
        // Found! Create relationship with InternalRelationship
        console.log(`✅ Found relationship: ${fromValue} → ${toValue}`);
        relationships.push({
          fromLevel,
          fromValue,
          toLevel,
          toValue,
          // Use only relationships that exist between these two nodes
          internalRelationships: [...childRelationships]
        });
      } else {
        // Not found in children - still create nodes but without relationship
        console.log(`ℹ️ No relationship found: ${fromValue} -/-> ${toValue} (will render both nodes without connection)`);
        relationships.push({
          fromLevel,
          fromValue,
          toLevel,
          toValue,
          internalRelationships: [] // Empty array = no relationship edge
        });
      }
    });
  });

  console.log(`📊 Built ${relationships.length} relationships/node pairs`);
  return relationships;
}

/**
 * Get all nodes involved in the graph (both FROM and TO nodes)
 */
export function getGraphNodes(
  structure: HierarchicalDataStructure,
  fromLevel: HierarchyLevel,
  fromValues: string[],
  toLevel: HierarchyLevel,
  toValues: string[]
): {
  fromNodes: Array<{ level: HierarchyLevel; value: string; }>;
  toNodes: Array<{ level: HierarchyLevel; value: string; }>;
} {
  const fromNodes: Array<{ level: HierarchyLevel; value: string; }> = [];
  const toNodes: Array<{ level: HierarchyLevel; value: string; }> = [];

  // Add all FROM values that exist in structure
  fromValues.forEach(value => {
    if (structure[fromLevel][value]) {
      fromNodes.push({ level: fromLevel, value });
    }
  });

  // Add all TO values that exist in structure
  toValues.forEach(value => {
    if (structure[toLevel][value]) {
      toNodes.push({ level: toLevel, value });
    }
  });

  return { fromNodes, toNodes };
}

/**
 * Get node position from structure
 */
export function getNodePosition(
  structure: HierarchicalDataStructure,
  level: HierarchyLevel,
  value: string
): { x: number; y: number } | null {
  const node = structure[level][value];
  if (!node) return null;
  return node.Position;
}

/**
 * Check if node is visible (not hidden or filtered)
 */
export function isNodeVisible(
  structure: HierarchicalDataStructure,
  level: HierarchyLevel,
  value: string
): boolean {
  const node = structure[level][value];
  if (!node) return false;
  return !node.Hidden && !node.FilteredOut;
}

/**
 * Get statistics about the graph
 */
export function getGraphStats(relationships: GraphRelationship[]): {
  totalRelationships: number;
  fromNodeCount: number;
  toNodeCount: number;
  uniqueRelationshipTypes: number;
} {
  const fromNodes = new Set<string>();
  const toNodes = new Set<string>();
  const relationshipTypes = new Set<string>();

  relationships.forEach(rel => {
    fromNodes.add(`${rel.fromLevel}::${rel.fromValue}`);
    toNodes.add(`${rel.toLevel}::${rel.toValue}`);
    rel.internalRelationships.forEach(type => relationshipTypes.add(type));
  });

  return {
    totalRelationships: relationships.length,
    fromNodeCount: fromNodes.size,
    toNodeCount: toNodes.size,
    uniqueRelationshipTypes: relationshipTypes.size
  };
}

/**
 * Convert GraphRelationship[] to TableRelation[] format
 * This allows the existing Graph component to render the nodes and edges
 */
export function convertToTableRelations(relationships: GraphRelationship[]): any[] {
  const tableRelations: any[] = [];
  const seen = new Set<string>();

  const pushUnique = (rel: any) => {
    const key = `${rel.parentTableType}|${rel.parentTableName}|${rel.relationship}|${rel.childTableType}|${rel.childTableName}`;
    if (seen.has(key)) return;
    seen.add(key);
    tableRelations.push(rel);
  };

  relationships.forEach(rel => {
    // For each internal relationship, create a separate table relation
    if (rel.internalRelationships.length > 0) {
      rel.internalRelationships.forEach(internalRel => {
        pushUnique({
          parentTableName: rel.fromValue,
          parentTableType: rel.fromLevel,
          childTableName: rel.toValue,
          childTableType: rel.toLevel,
          relationship: internalRel,
          // Add all hierarchy fields for compatibility
          parentSector: rel.fromLevel === 'Sector' ? rel.fromValue : '',
          parentApplication: rel.fromLevel === 'Application' ? rel.fromValue : '',
          parentPurpose: rel.fromLevel === 'Purpose' ? rel.fromValue : '',
          parentClient: rel.fromLevel === 'Client' ? rel.fromValue : '',
          parentTool: rel.fromLevel === 'Tool' ? rel.fromValue : '',
          parentSystem: rel.fromLevel === 'System' ? rel.fromValue : '',
          parentSchema: rel.fromLevel === 'Schema' ? rel.fromValue : '',
          parentObjectName: rel.fromLevel === 'ObjectName' ? rel.fromValue : '',
          childSector: rel.toLevel === 'Sector' ? rel.toValue : '',
          childApplication: rel.toLevel === 'Application' ? rel.toValue : '',
          childPurpose: rel.toLevel === 'Purpose' ? rel.toValue : '',
          childClient: rel.toLevel === 'Client' ? rel.toValue : '',
          childTool: rel.toLevel === 'Tool' ? rel.toValue : '',
          childSystem: rel.toLevel === 'System' ? rel.toValue : '',
          childSchema: rel.toLevel === 'Schema' ? rel.toValue : '',
          childObjectName: rel.toLevel === 'ObjectName' ? rel.toValue : ''
        });
      });
    } else {
      // No internal relationships - create entries for isolated nodes
      // We need to ensure both FROM and TO nodes appear in the graph
      // Create a dummy relationship entry for each node
      pushUnique({
        parentTableName: rel.fromValue,
        parentTableType: rel.fromLevel,
        childTableName: rel.fromValue, // Self-reference to ensure node appears
        childTableType: rel.fromLevel,
        relationship: '',
        parentSector: rel.fromLevel === 'Sector' ? rel.fromValue : '',
        parentApplication: rel.fromLevel === 'Application' ? rel.fromValue : '',
        parentPurpose: rel.fromLevel === 'Purpose' ? rel.fromValue : '',
        parentClient: rel.fromLevel === 'Client' ? rel.fromValue : '',
        parentTool: rel.fromLevel === 'Tool' ? rel.fromValue : '',
        parentSystem: rel.fromLevel === 'System' ? rel.fromValue : '',
        parentSchema: rel.fromLevel === 'Schema' ? rel.fromValue : '',
        parentObjectName: rel.fromLevel === 'ObjectName' ? rel.fromValue : '',
        childSector: rel.fromLevel === 'Sector' ? rel.fromValue : '',
        childApplication: rel.fromLevel === 'Application' ? rel.fromValue : '',
        childPurpose: rel.fromLevel === 'Purpose' ? rel.fromValue : '',
        childClient: rel.fromLevel === 'Client' ? rel.fromValue : '',
        childTool: rel.fromLevel === 'Tool' ? rel.fromValue : '',
        childSystem: rel.fromLevel === 'System' ? rel.fromValue : '',
        childSchema: rel.fromLevel === 'Schema' ? rel.fromValue : '',
        childObjectName: rel.fromLevel === 'ObjectName' ? rel.fromValue : ''
      });
      
      // Also add the TO node
      pushUnique({
        parentTableName: rel.toValue,
        parentTableType: rel.toLevel,
        childTableName: rel.toValue, // Self-reference
        childTableType: rel.toLevel,
        relationship: '',
        parentSector: rel.toLevel === 'Sector' ? rel.toValue : '',
        parentApplication: rel.toLevel === 'Application' ? rel.toValue : '',
        parentPurpose: rel.toLevel === 'Purpose' ? rel.toValue : '',
        parentClient: rel.toLevel === 'Client' ? rel.toValue : '',
        parentTool: rel.toLevel === 'Tool' ? rel.toValue : '',
        parentSystem: rel.toLevel === 'System' ? rel.toValue : '',
        parentSchema: rel.toLevel === 'Schema' ? rel.toValue : '',
        parentObjectName: rel.toLevel === 'ObjectName' ? rel.toValue : '',
        childSector: rel.toLevel === 'Sector' ? rel.toValue : '',
        childApplication: rel.toLevel === 'Application' ? rel.toValue : '',
        childPurpose: rel.toLevel === 'Purpose' ? rel.toValue : '',
        childClient: rel.toLevel === 'Client' ? rel.toValue : '',
        childTool: rel.toLevel === 'Tool' ? rel.toValue : '',
        childSystem: rel.toLevel === 'System' ? rel.toValue : '',
        childSchema: rel.toLevel === 'Schema' ? rel.toValue : '',
        childObjectName: rel.toLevel === 'ObjectName' ? rel.toValue : ''
      });
    }
  });

  return tableRelations;
}

/**
 * V4 logic per latest spec:
 * 1) Cross-section edges (FROM level != TO level):
 *    - If a FROM node is connected to a TO node in the new structure (child entry exists),
 *      create edges using ONLY the SameHierarchialRelationships.xlsx mapping for (fromLevel -> toLevel).
 *    - If not connected, include the pair with no relationships so nodes still render.
 * 2) Intra-section edges (within FROM and within TO):
 *    - For each pair of nodes within the same section, if connected via the new structure (child entry exists),
 *      use the per-pair InternalRelationship array to connect those nodes.
 */
export async function buildGraphRelationshipsV4(
  structure: HierarchicalDataStructure,
  fromLevel: HierarchyLevel,
  fromValues: string[],
  toLevel: HierarchyLevel,
  toValues: string[]
): Promise<GraphRelationship[]> {
  const out: GraphRelationship[] = [];
  if (!fromValues?.length || !toValues?.length) return out;

  const mapping = await loadSameHierarchyMapping();

  // Step 1: Cross-section edges using mapping if connected in structure
  if (fromLevel !== toLevel) {
    for (const fromValue of fromValues) {
      const fromNode = structure[fromLevel][fromValue];
      const toMap = (fromNode?.Childs?.[toLevel] || {}) as Record<string, string[]>;
      for (const toValue of toValues) {
        const isConnected = Object.prototype.hasOwnProperty.call(toMap, toValue);
        if (isConnected) {
          const rels = getMappedRelationships(mapping, fromLevel, toLevel);
          out.push({ fromLevel, fromValue, toLevel, toValue, internalRelationships: [...rels] });
        } else {
          // Include as isolated pair to ensure nodes render
          out.push({ fromLevel, fromValue, toLevel, toValue, internalRelationships: [] });
        }
      }
    }
  } else {
    // Same level across sections: we still include pairs (no mapping applied here)
    for (const fromValue of fromValues) {
      for (const toValue of toValues) {
        out.push({ fromLevel, fromValue, toLevel, toValue, internalRelationships: [] });
      }
    }
  }

  // Step 2: Intra-section edges within FROM
  for (let i = 0; i < fromValues.length; i++) {
    for (let j = i + 1; j < fromValues.length; j++) {
      const a = fromValues[i];
      const b = fromValues[j];
      const nodeA = structure[fromLevel][a];
      const mapA = (nodeA?.Childs?.[fromLevel] || {}) as Record<string, string[]>;
      const relAB = mapA[b] || [];
      const nodeB = structure[fromLevel][b];
      const mapB = (nodeB?.Childs?.[fromLevel] || {}) as Record<string, string[]>;
      const relBA = mapB[a] || [];
      const combined = Array.from(new Set([...(relAB || []), ...(relBA || [])]));
      if (combined.length > 0) {
        out.push({ fromLevel, fromValue: a, toLevel: fromLevel, toValue: b, internalRelationships: combined });
      }
    }
  }

  // Step 2: Intra-section edges within TO
  for (let i = 0; i < toValues.length; i++) {
    for (let j = i + 1; j < toValues.length; j++) {
      const a = toValues[i];
      const b = toValues[j];
      const nodeA = structure[toLevel][a];
      const mapA = (nodeA?.Childs?.[toLevel] || {}) as Record<string, string[]>;
      const relAB = mapA[b] || [];
      const nodeB = structure[toLevel][b];
      const mapB = (nodeB?.Childs?.[toLevel] || {}) as Record<string, string[]>;
      const relBA = mapB[a] || [];
      const combined = Array.from(new Set([...(relAB || []), ...(relBA || [])]));
      if (combined.length > 0) {
        out.push({ fromLevel: toLevel, fromValue: a, toLevel: toLevel, toValue: b, internalRelationships: combined });
      }
    }
  }

  return out;
}

/**
 * V5 logic for multi-level selection:
 * Build relationships showing connections between nodes across multiple selected levels
 * - For each pair of levels, find connections between selected values
 * - Within each level, find connections between selected values
 * - Preserves the existing relationship logic
 */
export async function buildGraphRelationshipsV5(
  structure: HierarchicalDataStructure,
  selectedLevels: HierarchyLevel[],
  selectedValues: string[]
): Promise<GraphRelationship[]> {
  const out: GraphRelationship[] = [];
  if (!selectedLevels?.length || !selectedValues?.length) return out;

  const mapping = await loadSameHierarchyMapping();

  // Build a map of level -> values for quick lookup
  const levelValuesMap = new Map<HierarchyLevel, string[]>();
  selectedLevels.forEach(level => {
    const values = selectedValues.filter(value => 
      structure[level] && structure[level][value]
    );
    if (values.length > 0) {
      levelValuesMap.set(level, values);
    }
  });

  // NEW CASCADING LOGIC:
  // When multiple levels selected: Level1 → Level2, Level2 → Level3, etc.
  // Plus intra-level connections within the last level
  
  if (selectedLevels.length > 1) {
    // Step 1: Cascading cross-level relationships (only between consecutive levels)
    for (let i = 0; i < selectedLevels.length - 1; i++) {
      const fromLevel = selectedLevels[i];
      const toLevel = selectedLevels[i + 1]; // Next level in cascade
      const fromValues = levelValuesMap.get(fromLevel) || [];
      const toValues = levelValuesMap.get(toLevel) || [];

      // Check connections between consecutive level pairs
      for (const fromValue of fromValues) {
        const fromNode = structure[fromLevel][fromValue];
        const toMap = (fromNode?.Childs?.[toLevel] || {}) as Record<string, string[]>;
        
        for (const toValue of toValues) {
          const isConnected = Object.prototype.hasOwnProperty.call(toMap, toValue);
          if (isConnected) {
            const rels = getMappedRelationships(mapping, fromLevel, toLevel);
            out.push({ 
              fromLevel, 
              fromValue, 
              toLevel, 
              toValue, 
              internalRelationships: [...rels] 
            });
          }
        }
      }
    }

    // Step 2: Intra-level relationships within the LAST selected level only
    const lastLevel = selectedLevels[selectedLevels.length - 1];
    const values = levelValuesMap.get(lastLevel) || [];
    
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i];
        const b = values[j];
        
        const nodeA = structure[lastLevel][a];
        const mapA = (nodeA?.Childs?.[lastLevel] || {}) as Record<string, string[]>;
        const relAB = mapA[b] || [];
        
        const nodeB = structure[lastLevel][b];
        const mapB = (nodeB?.Childs?.[lastLevel] || {}) as Record<string, string[]>;
        const relBA = mapB[a] || [];
        
        const combined = Array.from(new Set([...(relAB || []), ...(relBA || [])]));
        if (combined.length > 0) {
          out.push({ 
            fromLevel: lastLevel, 
            fromValue: a, 
            toLevel: lastLevel, 
            toValue: b, 
            internalRelationships: combined 
          });
        }
      }
    }
  } else if (selectedLevels.length === 1) {
    // Special case: Only one level selected - show only intra-level connections
    const level = selectedLevels[0];
    const values = levelValuesMap.get(level) || [];
    
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i];
        const b = values[j];
        
        const nodeA = structure[level][a];
        const mapA = (nodeA?.Childs?.[level] || {}) as Record<string, string[]>;
        const relAB = mapA[b] || [];
        
        const nodeB = structure[level][b];
        const mapB = (nodeB?.Childs?.[level] || {}) as Record<string, string[]>;
        const relBA = mapB[a] || [];
        
        const combined = Array.from(new Set([...(relAB || []), ...(relBA || [])]));
        if (combined.length > 0) {
          out.push({ 
            fromLevel: level, 
            fromValue: a, 
            toLevel: level, 
            toValue: b, 
            internalRelationships: combined 
          });
        }
      }
    }
  }

  return out;
}
