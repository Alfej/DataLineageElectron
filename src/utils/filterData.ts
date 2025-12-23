import { TableRelation } from '../components/graph/graphModel';

interface FilterOptions {
  selectedLevels: string[];
  selectedTypes: string[];
  applyNeighborhood?: boolean;
}

/**
 * Recursively get all ancestors (parents, grandparents, etc.) of a node
 */
function getAllAncestors(
  nodeId: string,
  data: TableRelation[]
): string[] {
  const allParents = new Set<string>();
  const visited = new Set<string>();
  
  const traverseAncestors = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    
    const immediateParents = data
      .filter(d => d.childTableName === id)
      .map(d => d.parentTableName)
      .filter(Boolean);
    
    for (const parentId of immediateParents) {
      allParents.add(parentId);
      traverseAncestors(parentId);
    }
  };
  
  traverseAncestors(nodeId);
  return Array.from(allParents);
}

/**
 * Recursively get all descendants (children, grandchildren, etc.) of a node
 */
function getAllDescendants(
  nodeId: string,
  data: TableRelation[]
): string[] {
  const allChildren = new Set<string>();
  const visited = new Set<string>();
  
  const traverseDescendants = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    
    const immediateChildren = data
      .filter(d => d.parentTableName === id)
      .map(d => d.childTableName)
      .filter(Boolean);
    
    for (const childId of immediateChildren) {
      allChildren.add(childId);
      traverseDescendants(childId);
    }
  };
  
  traverseDescendants(nodeId);
  return Array.from(allChildren);
}

/**
 * Filters data based on selected levels and types, limiting to max 4000 nodes and edges
 */
export function filterDataWithLimit(
  data: TableRelation[],
  options: FilterOptions
): TableRelation[] {
  const { selectedLevels, selectedTypes, applyNeighborhood } = options;
  
  console.log(`[filterDataWithLimit] Input data rows: ${data.length}`);
  console.log(`[filterDataWithLimit] Selected levels:`, selectedLevels);
  console.log(`[filterDataWithLimit] Apply neighborhood:`, applyNeighborhood);
  
  // If nothing selected, return all data but limit it
  if (selectedLevels.length === 0 && selectedTypes.length === 0) {
    return limitDataSize(data, 4000);
  }

  // If neighborhood filter is enabled and levels are selected, include complete lineage
  let allowedNodes: Set<string> | null = null;
  if (applyNeighborhood && selectedLevels.length > 0) {
    const completeNeighborhood = new Set<string>();
    
    // For each selected level, get all ancestors and descendants
    selectedLevels.forEach(nodeId => {
      console.log(`[Neighborhood Filter] Processing node: ${nodeId}`);
      completeNeighborhood.add(nodeId);
      
      const ancestors = getAllAncestors(nodeId, data);
      const descendants = getAllDescendants(nodeId, data);
      
      console.log(`[Neighborhood Filter] Found ${ancestors.length} ancestors:`, ancestors);
      console.log(`[Neighborhood Filter] Found ${descendants.length} descendants:`, descendants);
      
      ancestors.forEach(a => completeNeighborhood.add(a));
      descendants.forEach(d => completeNeighborhood.add(d));
    });
    
    console.log(`[Neighborhood Filter] Total nodes in complete neighborhood: ${completeNeighborhood.size}`);
    console.log(`[Neighborhood Filter] Nodes:`, Array.from(completeNeighborhood));
    
    allowedNodes = completeNeighborhood;
  }

  // Filter based on selections
  const filtered = data.filter((row) => {
    // If neighborhood filter is active, ONLY check if both parent and child are in allowed nodes
    // Skip the levelMatch filter because allowedNodes already contains the complete lineage
    if (allowedNodes) {
      const inNeighborhood = allowedNodes.has(row.parentTableName) && allowedNodes.has(row.childTableName);
      // Still apply type filter if specified
      const typeMatch = selectedTypes.length === 0 ||
        selectedTypes.includes(String(row.parentTableType)) ||
        selectedTypes.includes(String(row.childTableType));
      return inNeighborhood && typeMatch;
    }
    
    // When neighborhood is NOT active, apply normal filters
    const levelMatch = selectedLevels.length === 0 || 
      selectedLevels.includes(String(row.parentTableName)) || 
      selectedLevels.includes(String(row.childTableName));
    
    const typeMatch = selectedTypes.length === 0 ||
      selectedTypes.includes(String(row.parentTableType)) ||
      selectedTypes.includes(String(row.childTableType));

    return levelMatch && typeMatch;
  });

  console.log(`[filterDataWithLimit] Filtered data rows: ${filtered.length}`);
  console.log(`[filterDataWithLimit] Sample filtered rows:`, filtered.slice(0, 5));

  // Apply size limit
  return limitDataSize(filtered, 4000);
}

/**
 * Limits the dataset to a maximum number of nodes and edges
 * Tries to maintain graph connectivity by including complete subgraphs
 */
function limitDataSize(data: TableRelation[], maxItems: number): TableRelation[] {
  if (data.length <= maxItems) {
    return data;
  }

  // Count unique nodes
  const nodesSet = new Set<string>();
  data.forEach((row) => {
    nodesSet.add(row.parentTableName);
    nodesSet.add(row.childTableName);
  });

  // If nodes are within limit, just limit edges
  if (nodesSet.size <= maxItems) {
    return data.slice(0, maxItems);
  }

  // Build a priority-based subset that maintains connectivity
  // Strategy: Start from most connected nodes and expand outward
  const nodeConnections = new Map<string, number>();
  data.forEach((row) => {
    nodeConnections.set(
      row.parentTableName, 
      (nodeConnections.get(row.parentTableName) || 0) + 1
    );
    nodeConnections.set(
      row.childTableName, 
      (nodeConnections.get(row.childTableName) || 0) + 1
    );
  });

  // Sort nodes by connection count (most connected first)
  const sortedNodes = Array.from(nodeConnections.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([node]) => node);

  // Select top nodes (aim for ~3000-3500 to leave room for edges)
  const targetNodeCount = Math.min(Math.floor(maxItems * 0.85), sortedNodes.length);
  const selectedNodes = new Set(sortedNodes.slice(0, targetNodeCount));

  // Include all edges where both parent and child are in selected nodes
  const result = data.filter((row) => 
    selectedNodes.has(row.parentTableName) && selectedNodes.has(row.childTableName)
  );

  // If still too large, truncate
  return result.slice(0, maxItems);
}

/**
 * Gets statistics about the filtered data
 */
export function getDataStats(data: TableRelation[]): {
  nodeCount: number;
  edgeCount: number;
  nodes: string[];
} {
  const nodesSet = new Set<string>();
  data.forEach((row) => {
    nodesSet.add(row.parentTableName);
    nodesSet.add(row.childTableName);
  });

  return {
    nodeCount: nodesSet.size,
    edgeCount: data.length,
    nodes: Array.from(nodesSet),
  };
}
