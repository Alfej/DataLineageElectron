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

// Helper function to find connected components
const findConnectedComponents = (nodes: Node[], edges: any[]): Node[][] => {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => nodeMap.set(node.id, node));
  
  const adjacencyList = new Map<string, Set<string>>();
  nodes.forEach(node => adjacencyList.set(node.id, new Set()));
  
  // Build adjacency list
  edges.forEach(edge => {
    const source = edge.source;
    const target = edge.target;
    if (adjacencyList.has(source) && adjacencyList.has(target)) {
      adjacencyList.get(source)!.add(target);
      adjacencyList.get(target)!.add(source);
    }
  });
  
  const visited = new Set<string>();
  const components: Node[][] = [];
  
  const dfs = (nodeId: string, component: Node[]) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (node) component.push(node);
    
    const neighbors = adjacencyList.get(nodeId) || new Set();
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        dfs(neighbor, component);
      }
    });
  };
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const component: Node[] = [];
      dfs(node.id, component);
      if (component.length > 0) {
        components.push(component);
      }
    }
  });
  
  return components;
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
  
  // Find connected components for better handling of disconnected nodes
  const components = findConnectedComponents(nodes, edges);
  
  // If we have multiple disconnected components, layout them separately
  if (components.length > 1) {
    return await layoutDisconnectedComponents(components, edges, direction, nodeHeights);
  }
  
  // Single component or all nodes connected - use standard layout
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      // Increase inter-layer and intra-layer spacing for a more spacious layout
      'elk.layered.spacing.nodeNodeBetweenLayers': '180',
      'elk.layered.spacing.edgeNodeBetweenLayers': '150',
      'elk.spacing.nodeNode': '120',
      'elk.spacing.componentComponent': '200',
      'elk.spacing.edgeEdge': '40',
      'elk.direction': elkDirection,
      // Improved options for better layout quality
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.unnecessaryBendpoints': 'false',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.portPort': '30',
      'elk.portConstraints': 'FIXED_SIDE',
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

// Layout disconnected components separately and arrange them in a grid
const layoutDisconnectedComponents = async (
  components: Node[][],
  edges: any[],
  direction: string,
  nodeHeights?: Record<string, number>
): Promise<{ nodes: Node[], edges: any[] }> => {
  const elkDirection = directionToElk[direction] || 'DOWN';
  const isHorizontal = direction === 'LR' || direction === 'RL';
  
  const layoutPromises = components.map(async (component, index) => {
    const componentNodeIds = new Set(component.map(n => n.id));
    const componentEdges = edges.filter(e => 
      componentNodeIds.has(e.source) && componentNodeIds.has(e.target)
    );
    
    const graph = {
      id: `component-${index}`,
      layoutOptions: {
        'elk.algorithm': 'layered',
        // Larger spacing for each disconnected component as well
        'elk.layered.spacing.nodeNodeBetweenLayers': '140',
        'elk.layered.spacing.edgeNodeBetweenLayers': '120',
        'elk.spacing.nodeNode': '100',
        'elk.spacing.edgeEdge': '30',
        'elk.direction': elkDirection,
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.unnecessaryBendpoints': 'false',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
        'elk.spacing.portPort': '30',
        'elk.portConstraints': 'FIXED_SIDE',
      },
      children: component.map((n) => ({
        id: n.id,
        width: nodeWidth,
        height: nodeHeights?.[n.id] || defaultNodeHeight,
      })),
      edges: componentEdges.map((e) => ({ 
        id: e.id || `${e.source}__${e.target}`, 
        sources: [e.source], 
        targets: [e.target] 
      })),
    };
    
    try {
      const layouted = await elk.layout(graph);
      return {
        component,
        layouted,
        width: ((layouted as any).width || 0) + 200, // Add more padding
        height: ((layouted as any).height || 0) + 200, // Add more padding
      };
    } catch (err) {
      console.warn(`ELK layout failed for component ${index}`, err);
      return {
        component,
        layouted: { children: component.map(n => ({ id: n.id, x: 0, y: 0 })) },
        width: nodeWidth + 100,
        height: (component.length * (defaultNodeHeight + 20)) + 100,
      };
    }
  });
  
  const layoutedComponents = await Promise.all(layoutPromises);
  
  // Sort components by size (largest first) for better arrangement
  layoutedComponents.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  // Arrange components in a grid pattern
  let currentX = 0;
  let currentY = 0;
  let maxHeightInRow = 0;
  const maxRowWidth = isHorizontal ? 2000 : 1500; // Adjust based on direction
  
  const allPositionedNodes: Node[] = [];
  
  layoutedComponents.forEach(({ component, layouted, width, height }) => {
    // Check if we need to start a new row
    if (currentX + width > maxRowWidth && currentX > 0) {
      currentX = 0;
      currentY += maxHeightInRow + 250; // Increase row spacing
      maxHeightInRow = 0;
    }
    
    maxHeightInRow = Math.max(maxHeightInRow, height);
    
    // Position nodes in this component
    component.forEach(node => {
      const children = (layouted as any).children || [];
      const gNode = children.find((c: any) => c.id === node.id) || { x: 0, y: 0 };
  const px = currentX + (typeof gNode.x === 'number' ? gNode.x : 0) + 100; // Add more padding
  const py = currentY + (typeof gNode.y === 'number' ? gNode.y : 0) + 100; // Add more padding
      
      const nodeHeight = nodeHeights?.[node.id] || defaultNodeHeight;
      
      allPositionedNodes.push({
        ...node,
        position: { x: px, y: py },
        style: {
          ...node.style,
          width: nodeWidth,
          height: nodeHeight,
          minHeight: nodeHeight,
        }
      });
    });
    
    currentX += width + 200; // Increase component spacing
  });
  
  return { nodes: allPositionedNodes, edges };
};

export default getLayoutedElements;