import getLayoutedElements from './graph/layout';

interface SimplifyFitParams {
  nodes: any[];
  edges: any[];
  hiddenNodes: Set<string>;
  layoutDirection: string;
  positions: Record<string, { x: number; y: number }>;
  setPositions: (p: any) => void;
  setNodes: (updater: (prev: any[]) => any[]) => void;
  pushHistoryAndRefresh: (entry: any) => Promise<void>;
  filters: any;
  neighborhoodNodes: string[];
  selectedNeighborhoodNodes: string[];
  debouncedSaveGraphState: (pos: Record<string, { x: number; y: number }>, hidden: Set<string>, data: any, filteredData: any) => void;
  data: any;
  filteredData: any;
  fitView: (opts?: any) => void;
}

// Performs Dagre layout on currently visible nodes, updates positions, records history, then fits view again.
export async function simplifyFit(params: SimplifyFitParams) {
  const { nodes, edges, hiddenNodes, layoutDirection, positions, setPositions, setNodes, pushHistoryAndRefresh, filters, neighborhoodNodes, selectedNeighborhoodNodes, debouncedSaveGraphState, data, filteredData, fitView } = params;
  try {
    await new Promise(r => setTimeout(r, 50));
    const visibleNodes = nodes.filter(n => !hiddenNodes.has(n.id));
    const visibleEdges = edges.filter(e => !hiddenNodes.has(e.source) && !hiddenNodes.has(e.target));
    if (!visibleNodes.length) return;
    const layouted = await getLayoutedElements(visibleNodes, visibleEdges, layoutDirection);
    const newPositions = { ...positions } as Record<string, { x: number; y: number }>;
    layouted.nodes.forEach((n: any) => {
      if (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number') {
        newPositions[n.id] = { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) };
      }
    });
    setPositions(newPositions);
    setNodes(prev => prev.map(node => ({ ...node, position: newPositions[node.id] || node.position })));
    const layoutPos = Object.fromEntries(layouted.nodes.map((n: any) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
    const fullSnapshot = { ...positions, ...layoutPos } as Record<string, { x: number; y: number }>;
    try { debouncedSaveGraphState(fullSnapshot, hiddenNodes, data, filteredData); } catch { }
    try {
      await pushHistoryAndRefresh({
        positions: newPositions,
        hidden: Array.from(hiddenNodes),
        filters,
        layoutDirection,
        neighborhoodNodes: [...neighborhoodNodes],
        selectedNeighborhoodNodes: [...selectedNeighborhoodNodes],
        timestamp: Date.now()
      });
    } catch { }
  } catch (e) {
    console.warn('simplifyFit failed', e);
  }
}

export default simplifyFit;