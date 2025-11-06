import getLayoutedElements from './graph/layout';

interface SimplifyFitParams {
  // Required core parameters
  nodes: any[];
  edges: any[];
  hiddenNodes: Set<string>;
  layoutDirection: string;
  positions: Record<string, { x: number; y: number }>;
  setPositions: (p: any) => void;
  setNodes: (updater: (prev: any[]) => any[]) => void;
  
  // Required for proper filtering - the original data
  data: any[];
  filteredData: any[];
  
  // Optional parameters with defaults
  fitView?: (opts?: any) => void;
  fitViewOptions?: any;
  pushHistoryAndRefresh?: (entry: any) => Promise<void>;
  filters?: any;
  neighborhoodNodes?: string[];
  selectedNeighborhoodNodes?: string[];
  currentNeighborhoodFilterNodeId?: string | null;
  debouncedSaveGraphState?: (pos: Record<string, { x: number; y: number }>, hidden: Set<string>, data: any, filteredData: any) => void;
  
  // Control options
  skipFitView?: boolean;
  skipHistory?: boolean;
  skipSaveState?: boolean;
  delay?: number;
}

// Performs ELK layout on currently visible nodes, updates positions, optionally records history and fits view
export async function simplifyFit(params: SimplifyFitParams): Promise<{ success: boolean; message?: string }> {
  const { 
    nodes, 
    edges, 
    hiddenNodes, 
    layoutDirection, 
    positions, 
    setPositions, 
    setNodes,
    data,
    filteredData,
    fitView,
    fitViewOptions = { duration: 800 },
    pushHistoryAndRefresh,
    filters = {},
    neighborhoodNodes = [],
    selectedNeighborhoodNodes = [],
    currentNeighborhoodFilterNodeId = null,
    debouncedSaveGraphState,
    skipFitView = false,
    skipHistory = false,
    skipSaveState = false,
    delay = 50
  } = params;

  try {
    // Add small delay to allow UI to settle
    if (delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }

    // Get all unique node IDs from the data (not just from current nodes array)
    const allNodeIds = new Set<string>();
    data.forEach((row: any) => {
      if (row.parentTableName) allNodeIds.add(row.parentTableName);
      if (row.childTableName) allNodeIds.add(row.childTableName);
    });

    // Filter to nodes that should be visible:
    // 1. Not hidden by user (hiddenNodes)
    // 2. Present in filteredData (passes column and neighborhood filters)
    const visibleNodeIds = new Set<string>();
    filteredData.forEach((row: any) => {
      if (row.parentTableName && !hiddenNodes.has(row.parentTableName)) {
        visibleNodeIds.add(row.parentTableName);
      }
      if (row.childTableName && !hiddenNodes.has(row.childTableName)) {
        visibleNodeIds.add(row.childTableName);
      }
    });

    // Create nodes array for layout - only include nodes that should be visible
    const visibleNodes = nodes.filter(n => visibleNodeIds.has(n.id));
    
    // Create edges array for layout - only include edges between visible nodes
    const visibleEdges = edges.filter(e => 
      visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );
    
    if (!visibleNodes.length) {
      return { success: false, message: 'No visible nodes to layout' };
    }

    // Get layouted elements using ELK
    const layouted = await getLayoutedElements(visibleNodes, visibleEdges, layoutDirection);
    
    // Create new positions object - preserve existing positions for all nodes
    const newPositions = { ...positions } as Record<string, { x: number; y: number }>;
    
    // Update positions only for nodes that were layouted
    layouted.nodes.forEach((n: any) => {
      if (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number') {
        newPositions[n.id] = { 
          x: Number(n.position.x.toFixed(5)), 
          y: Number(n.position.y.toFixed(5)) 
        };
      }
    });

    // Update positions state
    setPositions(newPositions);
    
    // Update ALL nodes with their positions (whether they were layouted or not)
    setNodes(prev => prev.map(node => ({ 
      ...node, 
      position: newPositions[node.id] || node.position 
    })));

    // Save state if not skipped and function provided
    if (!skipSaveState && debouncedSaveGraphState) {
      try { 
        debouncedSaveGraphState(newPositions, hiddenNodes, data, filteredData); 
      } catch (error) {
        console.warn('Failed to save graph state:', error);
      }
    }

    // Push to history if not skipped and function provided
    if (!skipHistory && pushHistoryAndRefresh) {
      try {
        await pushHistoryAndRefresh({
          positions: newPositions,
          hidden: Array.from(hiddenNodes),
          filters,
          layoutDirection,
          neighborhoodNodes: [...neighborhoodNodes],
          selectedNeighborhoodNodes: [...selectedNeighborhoodNodes],
          currentNeighborhoodFilterNodeId,
          // Note: hierarchyLevel is not known here; caller should augment via makeSnapshot or extend params if needed.
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('Failed to push history:', error);
      }
    }

    // Fit view if not skipped and function provided
    if (!skipFitView && fitView) {
      // Small delay to ensure layout changes are applied before fitting
      setTimeout(() => {
        try {
          fitView(fitViewOptions);
        } catch (error) {
          console.warn('Failed to fit view:', error);
        }
      }, 100);
    }

    return { success: true, message: `Successfully layouted ${visibleNodes.length} nodes` };

  } catch (error) {
    console.error('simplifyFit failed:', error);
    return { success: false, message: `Layout failed: ${error}` };
  }
}

// Convenience function for just layout + fit (no history/state saving)
export async function layoutAndFit(params: Pick<SimplifyFitParams, 'nodes' | 'edges' | 'hiddenNodes' | 'layoutDirection' | 'positions' | 'setPositions' | 'setNodes' | 'fitView' | 'data' | 'filteredData'> & { fitViewOptions?: any }): Promise<{ success: boolean; message?: string }> {
  return simplifyFit({
    ...params,
    skipHistory: true,
    skipSaveState: true,
    fitViewOptions: params.fitViewOptions || { duration: 800 }
  });
}

// Convenience function for just layout (no fit, no history/state saving)
export async function layoutOnly(params: Pick<SimplifyFitParams, 'nodes' | 'edges' | 'hiddenNodes' | 'layoutDirection' | 'positions' | 'setPositions' | 'setNodes' | 'data' | 'filteredData'>): Promise<{ success: boolean; message?: string }> {
  return simplifyFit({
    ...params,
    skipFitView: true,
    skipHistory: true,
    skipSaveState: true
  });
}

export default simplifyFit;