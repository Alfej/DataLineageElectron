import ELK from 'elkjs/lib/elk.bundled.js';
import { Node } from 'reactflow';

const nodeWidth = 180;
const defaultNodeHeight = 50;

// Cache ELK instance (it's stateless but reuse is fine)
const elk = new ELK();

// Map React Flow direction codes to ELK layerings
// TB -> DOWN, BT -> UP, LR -> RIGHT, RL -> LEFT
const directionToElk: Record<string, string> = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
};

// direction: 'TB' | 'BT' | 'LR' | 'RL'
// nodeHeights: optional map of node ID to height
export const getLayoutedElements = async (
  nodes: Node[], 
  edges: any[], 
  direction: string = 'TB',
  nodeHeights?: Record<string, number>
) => {
  const elkDirection = directionToElk[direction] || 'DOWN';

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.layered.spacing.nodeNodeBetweenLayers': '150',
      'elk.spacing.nodeNode': '100',
      'elk.direction': elkDirection,
      // Additional options to handle varying node heights
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.unnecessaryBendpoints': 'true',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.separateConnectedComponents': 'false',
      'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
      'elk.spacing.componentComponent': '100',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: nodeWidth,
      height: nodeHeights?.[n.id] || defaultNodeHeight,
    })),
    edges: edges.map((e) => ({ 
      id: e.id || `${e.source}__${e.target}`, 
      sources: [e.source], 
      targets: [e.target] 
    })),
  } as any;

  let layouted: any;
  try {
    layouted = await elk.layout(graph);
  } catch (err) {
    console.warn('ELK layout failed, falling back to original positions', err);
    // Return nodes unchanged (fallback)
    return { nodes, edges };
  }

  const positionedNodes = nodes.map((node) => {
    const gNode = layouted.children.find((c: any) => c.id === node.id) || { x: 0, y: 0 };
    const px = typeof gNode.x === 'number' ? Number(gNode.x) : 0;
    const py = typeof gNode.y === 'number' ? Number(gNode.y) : 0;
    
    // Preserve the dynamic height in the returned node
    const nodeHeight = nodeHeights?.[node.id] || defaultNodeHeight;
    
    return {
      ...node,
      position: { x: px, y: py },
      style: {
        ...node.style,
        width: nodeWidth,
        height: nodeHeight,
        minHeight: nodeHeight,
      }
    };
  });

  return { nodes: positionedNodes, edges };
};

export default getLayoutedElements;