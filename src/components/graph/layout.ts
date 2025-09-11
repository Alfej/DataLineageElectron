import dagre from 'dagre';
import { Node } from 'reactflow';

const nodeWidth = 180;
const nodeHeight = 50;

export const getLayoutedElements = (nodes: Node[], edges: any[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

  nodes.forEach((node) =>
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  );
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const pos = dagreGraph.node(node.id) || { x: 0, y: 0 };
      const px = typeof pos.x === 'number' ? Number(pos.x) : 0;
      const py = typeof pos.y === 'number' ? Number(pos.y) : 0;
      return {
        ...node,
        position: { x: px - nodeWidth / 2, y: py - nodeHeight / 2 },
      };
    }),
    edges,
  };
};

export default getLayoutedElements;
