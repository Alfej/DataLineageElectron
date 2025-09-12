import ELK from 'elkjs/lib/elk.bundled.js';
import { Node } from 'reactflow';

const nodeWidth = 180;
const nodeHeight = 50;

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
export const getLayoutedElements = async (nodes: Node[], edges: any[], direction: string = 'TB') => {
  const elkDirection = directionToElk[direction] || 'DOWN';

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '50',
      'elk.direction': elkDirection,
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: nodeWidth,
      height: nodeHeight,
    })),
    edges: edges.map((e) => ({ id: e.id || `${e.source}__${e.target}`, sources: [e.source], targets: [e.target] })),
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
    return {
      ...node,
      position: { x: px, y: py },
    };
  });

  return { nodes: positionedNodes, edges };
};

export default getLayoutedElements;
