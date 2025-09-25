import { useCallback, useRef } from 'react';

// Custom debounce function to avoid lodash dependency
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}

interface TableRelation {
  parentTableName: string;
  childTableName: string;
}

interface GraphHistoryEntry {
  positions: Record<string, { x: number; y: number }>;
  hidden: string[];
  filters: any;
  layoutDirection: string;
  neighborhoodNodes: string[];
  selectedNeighborhoodNodes: string[];
  currentNeighborhoodFilterNodeId: string | null;
  timestamp: number;
}

interface NodeManualOperationsProps {
  // State values
  nodes: any[];
  positions: Record<string, { x: number; y: number }>;
  hiddenNodes: Set<string>;
  data: TableRelation[];
  filteredData: TableRelation[];
  filters: any;
  layoutDirection: string;
  neighborhoodNodes: string[];
  selectedNeighborhoodNodes: string[];
  currentNeighborhoodFilterNodeId: string | null;
  
  // State setters
  setPositions: (positions: Record<string, { x: number; y: number }> | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)) => void;
  setHiddenNodes: (hiddenNodes: Set<string>) => void;
  
  // Utility functions
  getStorageKey: (key: string) => string;
  pushHistoryAndRefresh: (entry: GraphHistoryEntry) => Promise<void>;
  
  // React Flow handlers
  onNodesChange: (changes: any[]) => void;
}

export function useNodeManualOperations(props: NodeManualOperationsProps) {
  const {
    nodes,
    positions,
    hiddenNodes,
    data,
    filteredData,
    filters,
    layoutDirection,
    neighborhoodNodes,
    selectedNeighborhoodNodes,
    currentNeighborhoodFilterNodeId,
    setPositions,
    setHiddenNodes,
    getStorageKey,
    pushHistoryAndRefresh,
    onNodesChange
  } = props;

  // Debounced function to save graph state to localStorage
  const debouncedSaveGraphState = useRef(
    debounce((positions: Record<string, { x: number; y: number }>, hidden: Set<string>, data: TableRelation[], filteredData: TableRelation[]) => {
      const state: Record<string, any> = {};
      Object.keys(positions).forEach((id) => {
        const pos = positions[id];
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
        // parents: rows where childTableName === id -> parentTableName
        const parents = data.filter((d) => d.childTableName === id).map((d) => d.parentTableName);
        const children = data.filter((d) => d.parentTableName === id).map((d) => d.childTableName);
        state[id] = {
          id,
          x: Number(pos.x.toFixed(5)),
          y: Number(pos.y.toFixed(5)),
          parents,
          children,
          hidden: hidden.has(id),
          filteredOut: !filteredData.some((row) => row.childTableName === id || row.parentTableName === id)
        };
      });
      try {
        if (Object.keys(state).length > 0) {
          localStorage.setItem(getStorageKey("graph_node_state"), JSON.stringify(state));
        }
      } catch { }
    }, 300)
  ).current;

  // Save graph state immediately (non-debounced)
  const saveGraphStateImmediate = useCallback((positions: Record<string, { x: number; y: number }>, hidden: Set<string>, data: TableRelation[], filteredData: TableRelation[]) => {
    const state: Record<string, any> = {};
    Object.keys(positions).forEach((id) => {
      const pos = positions[id];
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
      const parents = data.filter((d) => d.childTableName === id).map((d) => d.parentTableName);
      const children = data.filter((d) => d.parentTableName === id).map((d) => d.childTableName);
      state[id] = {
        id,
        x: Number(pos.x.toFixed(5)),
        y: Number(pos.y.toFixed(5)),
        parents,
        children,
        hidden: hidden.has(id),
        filteredOut: !filteredData.some((row) => row.childTableName === id || row.parentTableName === id)
      };
    });
    try {
      if (Object.keys(state).length > 0) {
        localStorage.setItem(getStorageKey("graph_node_state"), JSON.stringify(state));
      }
    } catch { }
  }, [getStorageKey]);

  // Handle node drag and position changes
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    
    // Update positions on drag with high precision
    const positionUpdates = changes
      .filter((c: any) => c.type === 'position')
      .reduce((acc: any, c: any) => {
        if (c.position && typeof c.position.x === 'number' && typeof c.position.y === 'number') {
          acc[c.id] = {
            x: Number(c.position.x.toFixed(5)),
            y: Number(c.position.y.toFixed(5))
          };
        }
        return acc;
      }, {});

    if (Object.keys(positionUpdates).length > 0) {
      // Build a full snapshot: stored positions + live node positions + these updates
      const livePositions = Object.fromEntries(nodes.map((n: any) => [n.id, n.position]));
      const snapshot: Record<string, { x: number; y: number }> = {
        ...positions,
        ...livePositions,
        ...positionUpdates,
      };
      
      // Save snapshot to localStorage (debounced) - no history save here, onNodeDragStop handles it
      debouncedSaveGraphState(snapshot, hiddenNodes, data, filteredData);
      
      // Update positions state
      setPositions((prev) => ({ ...prev, ...positionUpdates }));
    }
  }, [onNodesChange, nodes, positions, hiddenNodes, data, filteredData, debouncedSaveGraphState, setPositions]);

  // Hide node function
  const hideNode = useCallback(async (nodeId: string) => {
    try {
      // Create snapshot of current positions before hiding
      const liveNodePositions = Object.fromEntries(nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
      const positionsSnapshotBeforeHide = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
      
      // Hide the node
      const newHidden = new Set(hiddenNodes);
      newHidden.add(nodeId);
      
      // Save state immediately with hidden node
      saveGraphStateImmediate(positionsSnapshotBeforeHide, newHidden, data, filteredData);
      
      // Update hidden nodes state
      setHiddenNodes(newHidden);
      
      // Save to history
      setTimeout(async () => {
        try {
          const historyEntry: GraphHistoryEntry = {
            positions: positionsSnapshotBeforeHide,
            hidden: Array.from(newHidden),
            filters,
            layoutDirection,
            neighborhoodNodes: [...neighborhoodNodes],
            selectedNeighborhoodNodes: [...selectedNeighborhoodNodes],
            currentNeighborhoodFilterNodeId,
            timestamp: Date.now()
          };
          await pushHistoryAndRefresh(historyEntry);
        } catch (error) {
          console.warn('Failed to save hide history:', error);
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to hide node:', error);
    }
  }, [nodes, positions, hiddenNodes, data, filteredData, filters, layoutDirection, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId, saveGraphStateImmediate, setHiddenNodes, pushHistoryAndRefresh]);

  // Unhide node function
  const unhideNode = useCallback(async (nodeId: string) => {
    try {
      // Create snapshot of current positions before unhiding
      const liveNodePositions = Object.fromEntries(nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
      const positionsSnapshotBeforeUnhide = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
      
      // Unhide the node
      const newHidden = new Set(hiddenNodes);
      newHidden.delete(nodeId);
      
      // Save state immediately with unhidden node
      saveGraphStateImmediate(positionsSnapshotBeforeUnhide, newHidden, data, filteredData);
      
      // Update hidden nodes state
      setHiddenNodes(newHidden);
      
      // Save to history
      setTimeout(async () => {
        try {
          const historyEntry: GraphHistoryEntry = {
            positions: positionsSnapshotBeforeUnhide,
            hidden: Array.from(newHidden),
            filters,
            layoutDirection,
            neighborhoodNodes: [...neighborhoodNodes],
            selectedNeighborhoodNodes: [...selectedNeighborhoodNodes],
            currentNeighborhoodFilterNodeId,
            timestamp: Date.now()
          };
          await pushHistoryAndRefresh(historyEntry);
        } catch (error) {
          console.warn('Failed to save unhide history:', error);
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to unhide node:', error);
    }
  }, [nodes, positions, hiddenNodes, data, filteredData, filters, layoutDirection, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId, saveGraphStateImmediate, setHiddenNodes, pushHistoryAndRefresh]);

  // Handle node drag stop - this is more reliable than detecting drag end in onNodesChange
  const onNodeDragStop = useCallback(async (_event: any, node: any) => {
    try {
      // Create a snapshot with the final position
      const livePositions = Object.fromEntries(nodes.map((n: any) => [n.id, n.position]));
      const finalSnapshot: Record<string, { x: number; y: number }> = {
        ...positions,
        ...livePositions,
        [node.id]: {
          x: Number(node.position.x.toFixed(5)),
          y: Number(node.position.y.toFixed(5))
        }
      };
      
      // Save to localStorage immediately
      debouncedSaveGraphState(finalSnapshot, hiddenNodes, data, filteredData);
      
      // Update positions state
      setPositions(finalSnapshot);
      
      // Save to history
      const historyEntry: GraphHistoryEntry = {
        positions: finalSnapshot,
        hidden: Array.from(hiddenNodes),
        filters,
        layoutDirection,
        neighborhoodNodes: [...neighborhoodNodes],
        selectedNeighborhoodNodes: [...selectedNeighborhoodNodes],
        currentNeighborhoodFilterNodeId,
        timestamp: Date.now()
      };
      
      await pushHistoryAndRefresh(historyEntry);
      
    } catch (error) {
      console.error('Failed to handle drag stop:', error);
    }
  }, [nodes, positions, hiddenNodes, data, filteredData, filters, layoutDirection, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId, debouncedSaveGraphState, setPositions, pushHistoryAndRefresh]);

  return {
    handleNodesChange,
    hideNode,
    unhideNode,
    onNodeDragStop
  };
}

export default useNodeManualOperations;
