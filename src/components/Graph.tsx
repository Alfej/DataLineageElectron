import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  MiniMap,
  Panel,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { } from "@mui/material";
import {
  Tooltip,
  Box,
  Typography,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import FilterSelect from './FilterSelect';

import GraphModel, { TableRelation } from './graph/graphModel';
import { registerTypesFromData, getColorFor, getAllTypeMaps } from '../utils/typeColors';
import getLayoutedElements from './graph/layout';
import simplifyFit from './simplifyFit';
import { useNodeManualOperations } from './NodeManualOperations';
import LayoutDirection from './LayoutDirection';
import DownloadButton from './DownloadButton';
import SearchNode from './SearchNode';
import AnimatedControls from './AnimatedControls';
import TooltipContent from './graph/TooltipContent';
import FourHandleNode from './FourHandleNode';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/PepsiCoLogo.png';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SettingsBackupRestoreOutlinedIcon from '@mui/icons-material/SettingsBackupRestoreOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CloseIcon from '@mui/icons-material/Close';
import UndoOutlined from '@mui/icons-material/UndoOutlined';
import RedoOutlined from '@mui/icons-material/RedoOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { pushHistory, undo as undoHistory, redo as redoHistory, canUndo as canUndoHistory, canRedo as canRedoHistory, ensureInitial, GraphHistoryEntry } from '../utils/history';

// PepsiCo palette
const PEPSI_BLUE = '#004B93';
const PEPSI_LIGHT = '#BCC5E1';
const PEPSI_BG_LIGHT = '#EAF3FF';

// GraphModel provides traversal utilities for the data
// TooltipContent renders node tooltip details

const GraphInner = ({ data, fileKey }: { data: TableRelation[]; fileKey?: string | null }) => {
  const { fitView } = useReactFlow();
  const getStorageKey = (base: string) => (fileKey ? `${base}::${fileKey}` : base);
  const nodeWidth = 180;
  const navigate = useNavigate();

  // instantiate GraphModel to prepare traversal helpers (keeps lint happy)
  const graphModelRef = useRef<GraphModel | null>(null);
  useEffect(() => {
    graphModelRef.current = new GraphModel(data || []);
  }, [data]);
  // Debounce utility
  function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: any;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Debounced unified graph state setter
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
  const getAllAncestors = (nodeId: string, visited = new Set<string>()): string[] => {
    if (visited.has(nodeId)) return []; // Prevent infinite loops
    visited.add(nodeId);

    const immediateParents = data
      .filter(d => d.childTableName === nodeId)
      .map(d => d.parentTableName)
      .filter(Boolean);

    const ancestors = [...immediateParents];
    immediateParents.forEach(parent => {
      ancestors.push(...getAllAncestors(parent, new Set(visited)));
    });

    return [...new Set(ancestors)]; // Remove duplicates
  };

  // Helper function to recursively get all descendants
  const getAllDescendants = (nodeId: string, visited = new Set<string>()): string[] => {
    if (visited.has(nodeId)) return []; // Prevent infinite loops
    visited.add(nodeId);

    const immediateChildren = data
      .filter(d => d.parentTableName === nodeId)
      .map(d => d.childTableName)
      .filter(Boolean);

    const descendants = [...immediateChildren];
    immediateChildren.forEach(child => {
      descendants.push(...getAllDescendants(child, new Set(visited)));
    });

    return [...new Set(descendants)]; // Remove duplicates
  };
  // Immediate save helper used for actions that must persist instantly (save button, filter changes)
  const saveGraphStateImmediate = (positionsSnapshot: Record<string, { x: number; y: number }>, hidden: Set<string>, dataRows: TableRelation[], filteredRows: TableRelation[]) => {
    const state: Record<string, any> = {};
    Object.keys(positionsSnapshot).forEach((id) => {
      const pos = positionsSnapshot[id];
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
      const parents = dataRows.filter((d) => d.childTableName === id).map((d) => d.parentTableName);
      const children = dataRows.filter((d) => d.parentTableName === id).map((d) => d.childTableName);
      state[id] = {
        id,
        x: Number(pos.x.toFixed(5)),
        y: Number(pos.y.toFixed(5)),
        parents,
        children,
        hidden: hidden.has(id),
        filteredOut: !filteredRows.some((row) => row.childTableName === id || row.parentTableName === id)
      };
    });
    try {
      if (Object.keys(state).length > 0) {
        localStorage.setItem(getStorageKey("graph_node_state"), JSON.stringify(state));
      }
    } catch { }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [tableTypeMap, setTableTypeMap] = useState<Record<string, string>>({});
  const [relTypeMap, setRelTypeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const maps = getAllTypeMaps();
      setTableTypeMap(maps.table);
      setRelTypeMap(maps.relationship);
    } catch { }
  }, [data]);
  // Initialize filters from localStorage or default to empty
  const [filters, setFilters] = useState<{ [key: string]: string[] }>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey("current_Filters_state"));
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [columns, setColumns] = useState<string[]>([]);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [selectedHidden, setSelectedHidden] = useState<string[]>([]);
  // Persist layout direction per file (restore from localStorage if available)
  const [layoutDirection, setLayoutDirection] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey('graph_layout_direction'));
      return stored || 'TB';
    } catch {
      return 'TB';
    }
  });

  // Save layout direction whenever it changes so it persists across refreshes
  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey('graph_layout_direction'), layoutDirection);
    } catch { }
  }, [layoutDirection]);

  // Neighborhood filter (multi-select: choose nodes to focus on their complete lineage - all ancestors and descendants)
  const [neighborhoodNodes, setNeighborhoodNodes] = useState<string[]>([]);
  const [selectedNeighborhoodNodes, setSelectedNeighborhoodNodes] = useState<string[]>([]);
  // Track the currently filtered neighborhood node for toggle functionality
  const [currentNeighborhoodFilterNodeId, setCurrentNeighborhoodFilterNodeId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  
  // Fullscreen state for expanded graph view
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  // Force refresh key for ReactFlow instances to prevent conflicts
  const [refreshKey, setRefreshKey] = useState<number>(0);
  // Highlighted node from search
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  // Control flag to prevent history saves during auto-simplify sequence
  const [isAutoSimplifying, setIsAutoSimplifying] = useState<boolean>(false);

  // Control flag to prevent auto-simplify after undo/redo operations
  const [isUndoRedoOperation, setIsUndoRedoOperation] = useState<boolean>(false);

  // Pagination for the table
  const [page, setPage] = useState<number>(1);
  const rowsPerPage = 10;

  const refreshCanUndo = useCallback(async () => {
    try { setCanUndo(await canUndoHistory(fileKey ?? null)); } catch { setCanUndo(false); }
    try { setCanRedo(await canRedoHistory(fileKey ?? null)); } catch { setCanRedo(false); }
  }, [fileKey]);

  // Helper function to push history and immediately refresh undo/redo state
  const pushHistoryAndRefresh = useCallback(async (entry: GraphHistoryEntry) => {
    // Don't save to history if we're in the middle of auto-simplify sequence
    if (isAutoSimplifying) {
      return;
    }
    
    try {
      await pushHistory(fileKey ?? null, entry);
      await refreshCanUndo();
    } catch { }
  }, [fileKey, refreshCanUndo, isAutoSimplifying]);

  // Force push to history (bypasses auto-simplify flag) - used at end of sequence
  const forcePushHistoryAndRefresh = useCallback(async (entry: GraphHistoryEntry) => {
    try {
      await pushHistory(fileKey ?? null, entry);
      await refreshCanUndo();
    } catch { }
  }, [fileKey, refreshCanUndo]);

  // refreshCanRedo logic merged into refreshCanUndo

  // 🔹 Reset hidden nodes with precise position preservation
  // Load positions from `graph_node_state` in localStorage (file-scoped)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey("graph_node_state"));
      if (stored) {
        const parsed = JSON.parse(stored);
        const pos: Record<string, { x: number; y: number }> = {};
        Object.values(parsed).forEach((n: any) => {
          if (n?.id && typeof n?.x === 'number' && typeof n?.y === 'number') {
            pos[n.id] = { x: Number(n.x), y: Number(n.y) };
          }
        });
        return pos;
      }
      return {};
    } catch {
      return {};
    }
  });

  // helper to create a snapshot entry for history (merge stored and live positions)
  const makeSnapshot = useCallback((): GraphHistoryEntry => {
    const liveNodePositions = Object.fromEntries(
      nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }])
    );
    const mergedPositions = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
    return {
      positions: mergedPositions,
      hidden: Array.from(hiddenNodes),
      filters,
      layoutDirection,
      neighborhoodNodes: [...neighborhoodNodes],
      selectedNeighborhoodNodes: [...selectedNeighborhoodNodes],
      currentNeighborhoodFilterNodeId,
      timestamp: Date.now(),
    };
  }, [nodes, positions, hiddenNodes, filters, layoutDirection, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId]);
  const resetHiddenNodes = async () => {
    try {
      const stored = localStorage.getItem(getStorageKey("graph_node_state"));
      if (stored) {
        const parsed = JSON.parse(stored);
        const restoredPositions: Record<string, { x: number; y: number }> = {};
        Object.values(parsed).forEach((n: any) => {
          if (typeof n?.x === 'number' && typeof n?.y === 'number') {
            restoredPositions[n.id] = {
              x: Number(n.x.toFixed(5)),
              y: Number(n.y.toFixed(5))
            };
          }
        });
        setPositions(restoredPositions);
        // Ensure we save the precise positions
        debouncedSaveGraphState(restoredPositions, new Set(), data, filteredData);
      }
    } catch { }
    setHiddenNodes(new Set());
    // push history after reset
    try { await pushHistoryAndRefresh(makeSnapshot()); } catch { }
  };
  // Helper function to get complete lineage (all ancestors and descendants) stopping at hidden nodes
  const getCompleteLineage = (nodeId: string): { parents: string[], children: string[] } => {
    const allParents = new Set<string>();
    const allChildren = new Set<string>();
    const visited = new Set<string>();
    
    // Helper function to check if a node is hidden
    const isNodeHidden = (id: string): boolean => {
      try {
        const stored = localStorage.getItem(getStorageKey("graph_node_state"));
        if (stored) {
          const parsed = JSON.parse(stored);
          const nodeData = parsed[id];
          if (nodeData && nodeData.hidden === true) {
            return true;
          }
        }
      } catch { }
      return false;
    };
    
    // Helper function to get immediate parents and children
    const getImmediateRelations = (id: string): { parents: string[], children: string[] } => {
      try {
        const stored = localStorage.getItem(getStorageKey("graph_node_state"));
        if (stored) {
          const parsed = JSON.parse(stored);
          const nodeData = parsed[id];
          if (nodeData) {
            return {
              parents: nodeData.parents || [],
              children: nodeData.children || []
            };
          }
        }
      } catch { }
      
      // Fallback to data if localStorage doesn't have the info
      const parents = data.filter((d) => d.childTableName === id).map((d) => d.parentTableName).filter(Boolean);
      const children = data.filter((d) => d.parentTableName === id).map((d) => d.childTableName).filter(Boolean);
      return { parents, children };
    };
    
    // Recursive function to traverse all ancestors
    const traverseAncestors = (id: string) => {
      if (visited.has(id)) return; // Prevent infinite loops
      visited.add(id);
      
      const { parents } = getImmediateRelations(id);
      
      for (const parentId of parents) {
        if (!isNodeHidden(parentId)) {
          allParents.add(parentId);
          traverseAncestors(parentId); // Recursively get ancestors of this parent
        }
        // If the parent is hidden, we stop traversing its ancestors
      }
    };
    
    // Recursive function to traverse all descendants
    const traverseDescendants = (id: string) => {
      if (visited.has(id)) return; // Prevent infinite loops
      visited.add(id);
      
      const { children } = getImmediateRelations(id);
      
      for (const childId of children) {
        if (!isNodeHidden(childId)) {
          allChildren.add(childId);
          traverseDescendants(childId); // Recursively get descendants of this child
        }
        // If the child is hidden, we stop traversing its descendants
      }
    };
    
    // Reset visited set for each traversal type
    visited.clear();
    traverseAncestors(nodeId);
    
    visited.clear();
    traverseDescendants(nodeId);
    
    return {
      parents: Array.from(allParents),
      children: Array.from(allChildren)
    };
  };

  // Legacy function name for compatibility - now uses complete lineage
  const getImmediateFamily = (nodeId: string): { parents: string[], children: string[] } => {
    return getCompleteLineage(nodeId);
  };

  // 🔹 Extract dynamic columns and initialize/restore filters
  useEffect(() => {
    if (data.length > 0) {
      // register any new table/relationship types and assign colors
      try { registerTypesFromData(data as any[]); } catch { }
      const cols = Object.keys(data[0]);
      setColumns(cols);

      try {
        const stored = localStorage.getItem(getStorageKey("current_Filters_state"));
        if (stored) {
          const storedFilters = JSON.parse(stored);
          const validatedFilters = Object.fromEntries(
            cols.map(col => [col, storedFilters[col] || []])
          );
          setFilters(validatedFilters);
          localStorage.setItem(getStorageKey("current_Filters_state"), JSON.stringify(validatedFilters));
        } else {
          const defaultFilters = Object.fromEntries(cols.map(c => [c, []]));
          setFilters(defaultFilters);
          localStorage.setItem(getStorageKey("current_Filters_state"), JSON.stringify(defaultFilters));
        }
      } catch (error) {
        const defaultFilters = Object.fromEntries(cols.map(c => [c, []]));
        setFilters(defaultFilters);
        localStorage.setItem(getStorageKey("current_Filters_state"), JSON.stringify(defaultFilters));
      }
      // ensure initial history snapshot once positions are available later
    }
  }, [data]);

  // 🔹 Initialize history when component loads with data
  useEffect(() => {
    if (data && data.length > 0 && Object.keys(positions).length > 0) {
      // Ensure we have an initial history entry
      try {
        ensureInitial(fileKey ?? null, makeSnapshot()).then(() => {
          refreshCanUndo();
        });
      } catch { }
    }
  }, [data, positions, fileKey, makeSnapshot, refreshCanUndo]);

  // 🔹 Restore positions and hidden nodes from localStorage on mount, else use Dagre
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey("graph_node_state"));
      if (stored) {
        const parsed = JSON.parse(stored);
        const restoredPositions: Record<string, { x: number; y: number }> = {};
        const restoredHidden = new Set<string>();
        Object.values(parsed).forEach((n: any) => {
          if (typeof n?.x === 'number' && typeof n?.y === 'number') {
            restoredPositions[n.id] = { x: n.x, y: n.y };
          }
          if (n?.hidden) restoredHidden.add(n.id);
        });
        if (Object.keys(restoredPositions).length > 0) setPositions(restoredPositions);
        if (restoredHidden.size > 0) setHiddenNodes(restoredHidden);
        return;
      }
    } catch { }

    // If no localStorage, use Dagre for accurate layout
    if (data && data.length > 0) {
      const nodeMap: Record<string, boolean> = {};
      const createdNodes: any[] = [];
      const createdEdges: any[] = [];
      data.forEach((row, index) => {
        const { childTableName: child, parentTableName: parent, relationship } = row;
        if (!child || !parent) return;
        if (!nodeMap[parent]) {
          nodeMap[parent] = true;
          createdNodes.push({
            id: parent,
            data: {
              label: `${parent} (${row.parentTableType})`,
              details: data.filter((rel) => rel.parentTableName === parent || rel.childTableName === parent),
            },
            position: { x: 0, y: 0 },
            style: { padding: 10, borderRadius: '8px', border: '1px solid #999', background: getColorFor('table', row.parentTableType) || '#fff' },
          });
        }
        if (!nodeMap[child]) {
          nodeMap[child] = true;
          createdNodes.push({
            id: child,
            data: {
              label: `${child} (${row.childTableType})`,
              details: data.filter((rel) => rel.parentTableName === child || rel.childTableName === child),
            },
            position: { x: 0, y: 0 },
            style: { padding: 10, borderRadius: '8px', border: '1px solid #999', background: getColorFor('table', row.childTableType) || '#fff' },
          });
        }
        createdEdges.push({
          id: `e-${parent}-${child}-${index}`,
          source: parent,
          target: child,
          label: relationship,
          style: { strokeWidth: 2, stroke: getColorFor('relationship', relationship) || '#444' },
          labelStyle: { fill: '#333', fontWeight: 600, fontSize: 12 },
          labelBgStyle: { 
            fill: "#ffffff", 
            fillOpacity: 0.9,
            rx: 12, // rounded corners
            ry: 12  // rounded corners
          },
          labelBgPadding: [8, 12], // [vertical, horizontal] padding
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: getColorFor('relationship', relationship) || '#444' },
        });
      });

      (async () => {
        try {
          const layouted = await getLayoutedElements(createdNodes, createdEdges, layoutDirection);
          setPositions(
            layouted.nodes.reduce((acc: any, node: any) => {
              acc[node.id] = node.position;
              return acc;
            }, {})
          );
          try {
            const positionsSnapshot = Object.fromEntries(layouted.nodes.map((n: any) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
            saveGraphStateImmediate(positionsSnapshot, new Set(), data, filteredData);
          } catch { }
        } catch { }
      })();

      // Save to localStorage for future loads (file-scoped)
      // state population & persistence handled in async layout block above
    }
  }, [data]);

  // 🔹 Filtered dataset (applies column filters then optional neighborhood filter)
  const filteredData = useMemo(() => {
    const base = data.filter((row) =>
      Object.entries(filters).every(([col, val]) => {
        if (!val || (Array.isArray(val) && val.length === 0)) return true;
        if (Array.isArray(val)) {
          return val.includes(String(row[col]));
        }
        return String(row[col]) === val;
      })
    );

    if (!neighborhoodNodes || neighborhoodNodes.length === 0) return base;
    
    // For neighborhood filter, we want complete lineage (all ancestors and descendants)
    // The neighborhoodNodes array should contain: [selectedNode, ...allAncestors, ...allDescendants]
    const allowedNodes = new Set(neighborhoodNodes);

    return base.filter((row) => {
      // Include row only if both parent and child are in the allowed nodes set
      return allowedNodes.has(row.parentTableName) && allowedNodes.has(row.childTableName);
    });
  }, [data, filters, neighborhoodNodes]);

  // Reset page when filters/neighborhood change
  useEffect(() => { setPage(1); }, [filters, neighborhoodNodes, data]);

  // Auto-simplify function - runs after filtering/hide operations
  const autoSimplifyAndFit = useCallback(async () => {
    // Set flag to block any intermediate history saves
    setIsAutoSimplifying(true);
    
    try {
      // Small delay to allow state updates to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Sequence: Operation executed -> Simplify -> Fit -> Save to history
      const result = await simplifyFit({
        nodes,
        edges,
        hiddenNodes,
        layoutDirection,
        positions,
        setPositions,
        setNodes,
        filters,
        neighborhoodNodes,
        selectedNeighborhoodNodes,
        currentNeighborhoodFilterNodeId,
        debouncedSaveGraphState,
        data,
        filteredData,
        fitView,
        fitViewOptions: { duration: 800 },
        skipHistory: true, // Skip history during simplify - we'll save at the end
        skipSaveState: true // Skip state save during simplify - we'll save at the end
      });
      
      if (result.success) {
        // Save state after successful simplify
        try {
          debouncedSaveGraphState(positions, hiddenNodes, data, filteredData);
        } catch (error) {
          console.warn('Failed to save state after auto-simplify:', error);
        }
        
        // Only now save to history after the complete sequence is done
        try {
          await forcePushHistoryAndRefresh(makeSnapshot());
        } catch (error) {
          console.warn('Failed to save history after auto-simplify:', error);
        }
      } else {
        console.warn('Auto-simplify failed:', result.message);
      }
    } finally {
      // Always clear the flag, even if there was an error
      setIsAutoSimplifying(false);
    }
  }, [nodes, edges, hiddenNodes, layoutDirection, positions, setPositions, setNodes, filters, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId, debouncedSaveGraphState, data, filteredData, fitView, forcePushHistoryAndRefresh, makeSnapshot, setIsAutoSimplifying]);

  // Initialize NodeManualOperations hook for handling drag/drop, hide/unhide operations
  const nodeManualOps = useNodeManualOperations({
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
  });

  // Persist filters and latest node state whenever filters/hidden/positions/filteredData/neighborhoodNodes change
  useEffect(() => {
    (async () => {
      try {
        localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(filters));
      } catch { }

      // Save graph state immediately so reopen restores exact positions & filteredOut
      const liveNodePositions = Object.fromEntries(nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
      const fullSnapshot = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
      try { saveGraphStateImmediate(fullSnapshot, hiddenNodes, data, filteredData); } catch { }
      
      // Don't push to history here during auto-simplify - the sequence will handle it at the end
    })();
  }, [filters, hiddenNodes, positions, filteredData, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId, nodes, data]);

  // Auto-simplify after filter changes (with debounce) — but skip when all filters are cleared (e.g., Reset All)
  useEffect(() => {
    // Don't auto-simplify if we're in the middle of undo/redo or already auto-simplifying
    if (isUndoRedoOperation || isAutoSimplifying) {
      return;
    }

    // Determine whether any filter/neighborhood is actually active
    const hasActiveColumnFilters = Object.values(filters || {}).some((v: any) => Array.isArray(v) ? v.length > 0 : Boolean(v));
    const hasActiveNeighborhood = Boolean(currentNeighborhoodFilterNodeId) 
      || (Array.isArray(neighborhoodNodes) && neighborhoodNodes.length > 0)
      || (Array.isArray(selectedNeighborhoodNodes) && selectedNeighborhoodNodes.length > 0);

    // If nothing is active (i.e., Reset All), do not run simplify
    if (!hasActiveColumnFilters && !hasActiveNeighborhood) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (data.length > 0) {
        // Set flag before triggering auto-simplify
        setIsAutoSimplifying(true);
        autoSimplifyAndFit();
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timeoutId);
  }, [filters, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId]);

  // 🔹 Filter options (dependent on other selections and neighborhood)
  const filterOptions = useMemo(() => {
    const opts: { [key: string]: string[] } = {};

    columns.forEach((col) => {
      const values = new Set<string>();

      // For each row, check whether it passes current filters except for this column
      data.forEach((row) => {
        // neighborhood filter: if set, only consider rows where both parent and child are in the neighborhood
        if (neighborhoodNodes && neighborhoodNodes.length > 0) {
          const allowedNodes = new Set(neighborhoodNodes);
          
          // Skip rows that don't connect nodes in the neighborhood
          if (!(allowedNodes.has(row.parentTableName) && allowedNodes.has(row.childTableName))) {
            return;
          }
        }

        const passesOtherFilters = Object.entries(filters).every(([fCol, val]) => {
          if (fCol === col) return true; // ignore current col
          if (!val || (Array.isArray(val) && val.length === 0)) return true;
          if (Array.isArray(val)) return val.includes(String(row[fCol]));
          return String(row[fCol]) === val;
        });

        if (passesOtherFilters && row[col]) values.add(String(row[col]));
      });

      opts[col] = Array.from(values).sort();
    });

    return opts;
  }, [data, filters, columns, neighborhoodNodes]);

  // Available neighborhood options should respect current column filters (ignore neighborhood selection)
  const neighborhoodOptions = useMemo(() => {
    try {
      const base = data.filter((row) =>
        Object.entries(filters).every(([col, val]) => {
          if (!val || (Array.isArray(val) && val.length === 0)) return true;
          if (Array.isArray(val)) return val.includes(String(row[col]));
          return String(row[col]) === val;
        })
      );
      const set = new Set<string>();
      base.forEach((r) => {
        if (r.parentTableName) set.add(r.parentTableName);
        if (r.childTableName) set.add(r.childTableName);
      });
      return Array.from(set).sort();
    } catch {
      return graphModelRef.current?.getAllNodes() || [];
    }
  }, [data, filters]);

  // 🔹 Hide node function - using NodeManualOperations hook
  const hideNode = nodeManualOps.hideNode;

  // 🔹 Unhide node function - using NodeManualOperations hook
  const unhideNode = nodeManualOps.unhideNode;

  // 🔹 Ctrl+click to hide node
  const onNodeClick = useCallback(async (event: React.MouseEvent, node: any) => {
    if (event.ctrlKey || event.metaKey) { // Support both Ctrl (Windows/Linux) and Cmd (Mac)
      event.preventDefault();
      event.stopPropagation();
      if (!hiddenNodes.has(node.id)) {
        await hideNode(node.id);
      }
    }
  }, [hiddenNodes, hideNode]);

  // 🔹 Right-click to apply neighborhood filter (with toggle functionality)
  const onNodeContextMenu = useCallback(async (event: React.MouseEvent, node: any) => {
    event.preventDefault();
    
    // Check if we're right-clicking on the same node that's currently filtered
    if (currentNeighborhoodFilterNodeId === node.id) {
      // Toggle OFF: Reset neighborhood filter to show full graph
      setSelectedNeighborhoodNodes([]);
      setNeighborhoodNodes([]);
      setCurrentNeighborhoodFilterNodeId(null);
      
      // Fit view after resetting filter
      setTimeout(() => {
        fitView({ duration: 800 });
      }, 200); // Give time for state updates
      
      // Do not push history here; atomic simplify sequence will save once at the end
      
      return;
    }
    
    // Apply neighborhood filter for a different node (or first time)
    // Get immediate family from localStorage
    const { parents, children } = getImmediateFamily(node.id);
    
    // Create neighborhood filter: selected node + complete lineage (all ancestors + all descendants)
    const neighborhoodFilter = [node.id, ...parents, ...children].filter(Boolean);
    
    // Set both the user selection (just the clicked node) and the complete neighborhood
    setSelectedNeighborhoodNodes([node.id]);
    setNeighborhoodNodes(neighborhoodFilter);
    setCurrentNeighborhoodFilterNodeId(node.id);
    
    // Fit view after neighborhood filter
    setTimeout(() => {
      fitView({ duration: 800 });
    }, 200); // Give time for state updates
    
    // Do not push history here; atomic simplify sequence will save once at the end
  }, [currentNeighborhoodFilterNodeId, getImmediateFamily, fitView, pushHistoryAndRefresh, nodes, positions, hiddenNodes, filters, layoutDirection]);

  // 🔹 Build nodes & edges
  useEffect(() => {
    if (!filteredData.length) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const nodeMap: Record<string, boolean> = {};
    const createdNodes: any[] = [];
    const createdEdges: any[] = [];

    // helper to pick handle based on layout axis for straighter orthogonal edges
    const getClosestHandle = (nodePos: { x: number; y: number, id: string } | undefined, otherCenter: { x: number; y: number }) => {
      // console.log(`${nodePos?.id}`)
      const vertical = layoutDirection === 'TB' || layoutDirection === 'BT';
      if (!nodePos) return vertical ? 'top' : 'left';
      const center = { x: nodePos.x + nodeWidth / 2, y: nodePos.y / 2 };
      if (vertical) {
        return otherCenter.y < center.y ? 'top' : 'bottom';
      }
      return otherCenter.x < center.x ? 'left' : 'right';
    };

    filteredData.forEach((row, index) => {
      const { childTableName: child, parentTableName: parent, relationship } = row;
      if (!child || !parent) return;

      // Create parent node
      if (!hiddenNodes.has(parent) && !nodeMap[parent]) {
        nodeMap[parent] = true;
        const parentLabel = parent;

        createdNodes.push({
          id: parent,
          type: 'fourHandle',
          data: {
            label: parentLabel,
            details: filteredData.filter(
              (rel) => rel.parentTableName === parent || rel.childTableName === parent
            ),
          },
          position: positions[parent] !== undefined ? positions[parent] : nodes.find(n => n.id === parent)?.position || { x: 0, y: 0 },
          style: {
            padding: 10,
            borderRadius: "8px",
            border: "1px solid #999",
            background: getColorFor('table', row.parentTableType) || "#fff",
            width: nodeWidth,
            height: "auto",
            minHeight: "50px",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
        });
      }

      // Create child node
      if (!hiddenNodes.has(child) && !nodeMap[child]) {
        nodeMap[child] = true;
        const childLabel = child;

        createdNodes.push({
          type: 'fourHandle',
          id: child,
          data: {
            label: childLabel,
            details: filteredData.filter(
              (rel) => rel.parentTableName === child || rel.childTableName === child
            ),
          },
          position: positions[child] !== undefined ? positions[child] : nodes.find(n => n.id === child)?.position || { x: 0, y: 0 },
          style: {
            padding: 10,
            borderRadius: "8px",
            border: "1px solid #999",
            background: getColorFor('table', row.childTableType) || "#fff",
            width: nodeWidth,
            height: "auto",
            minHeight: "50px",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
        });
      }

      // Create edges with proper handle positioning based on dynamic heights
      if (!hiddenNodes.has(parent) && !hiddenNodes.has(child)) {
        const parentPos = createdNodes.find(n => n.id === parent)?.position || positions[parent];
        const childPos = createdNodes.find(n => n.id === child)?.position || positions[child];
        const parentCenter = parentPos ? {
          x: parentPos.x + nodeWidth / 2,
          y: parentPos.y / 2
        } : { x: 0, y: 0 };
        const childCenter = childPos ? {
          x: childPos.x + nodeWidth / 2,
          y: childPos.y  / 2
        } : { x: 0, y: 0 };

        const sourceHandle = getClosestHandle({ ...parentPos, id: parent }, childCenter);
        const targetHandle = getClosestHandle({ ...childPos, id: child }, parentCenter);

        createdEdges.push({
          id: `e-${parent}-${child}-${index}`,
          source: parent,
          target: child,
          sourceHandle,
          targetHandle,
          label: relationship,
          style: { strokeWidth: 2, stroke: getColorFor('relationship', relationship) || "#444" },
          labelStyle: { fill: "#333", fontWeight: 600, fontSize: 12 },
          labelBgStyle: { 
            fill: "#ffffff", 
            fillOpacity: 0.9,
            rx: 12, // rounded corners
            ry: 12  // rounded corners
          },
          labelBgPadding: [8, 12], // [vertical, horizontal] padding
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: getColorFor('relationship', relationship) || "#444",
          },
        });
      }
    });

    // Handle bridging edges for hidden nodes (update to use dynamic heights)
    if (hiddenNodes.size > 0) {
      const hiddenArray = Array.from(hiddenNodes);
      for (const hidden of hiddenArray) {
        const stored = (() => {
          try {
            const s = localStorage.getItem(getStorageKey('graph_node_state'));
            return s ? JSON.parse(s)[hidden] : null;
          } catch { return null; }
        })();
        const parents = stored?.parents?.filter(Boolean) || data.filter((d) => d.childTableName === hidden).map((d) => d.parentTableName).filter(Boolean);
        const children = stored?.children?.filter(Boolean) || data.filter((d) => d.parentTableName === hidden).map((d) => d.childTableName).filter(Boolean);

        for (const p of parents) {
          for (const c of children) {
            if (!hiddenNodes.has(p) && !hiddenNodes.has(c)) {
              const id = `bridge-${p}-${c}`;
              if (!createdEdges.find((e) => e.id === id)) {
                const relRow = data.find((d) => d.parentTableName === p && d.childTableName === hidden) || data.find((d) => d.parentTableName === hidden && d.childTableName === c);
                const rel = relRow ? relRow.relationship : '';

                const pPos = createdNodes.find(n => n.id === p)?.position || positions[p];
                const cPos = createdNodes.find(n => n.id === c)?.position || positions[c];
                const pCenter = pPos ? {
                  x: pPos.x + nodeWidth / 2,
                  y: pPos.y / 2
                } : { x: 0, y: 0 };
                const cCenter = cPos ? {
                  x: cPos.x + nodeWidth / 2,
                  y: cPos.y / 2
                } : { x: 0, y: 0 };

                const sHandle = getClosestHandle({ ...pPos, id: p }, cCenter);
                const tHandle = getClosestHandle({ ...cPos, id: c }, pCenter);

                createdEdges.push({
                  id,
                  source: p,
                  target: c,
                  sourceHandle: sHandle,
                  targetHandle: tHandle,
                  label: rel,
                  style: { strokeWidth: 2, stroke: getColorFor('relationship', rel) || '#444', strokeDasharray: '4 4', strokeLinecap: 'round' },
                  labelStyle: { fill: '#333', fontWeight: 600, fontSize: 12 },
                  labelBgStyle: { 
                    fill: "#ffffff", 
                    fillOpacity: 0.9,
                    rx: 12, // rounded corners
                    ry: 12  // rounded corners
                  },
                  labelBgPadding: [8, 12], // [vertical, horizontal] padding
                  markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: getColorFor('relationship', rel) || '#444' },
                });
              }
            }
          }
        }
      }
    }

    const runInitialLayout = async () => {
      if (Object.keys(positions).length === 0 && hiddenNodes.size === 0) {
        try {
          // Pass node heights to layout function
          const layouted = await getLayoutedElements(createdNodes, createdEdges, layoutDirection);
          setNodes(layouted.nodes as any);
          setEdges(layouted.edges as any);
          setPositions(layouted.nodes.reduce((acc: any, node: any) => { acc[node.id] = node.position; return acc; }, {}));
          return;
        } catch { }
      }
      setNodes(createdNodes);
      setEdges(createdEdges);
    };
    runInitialLayout();
  }, [filteredData, hiddenNodes, positions, layoutDirection]);

  // 🔹 Track node drag and update positions - using NodeManualOperations hook
  const handleNodesChange = nodeManualOps.handleNodesChange;

  // 🔹 Node hover
  const onNodeMouseEnter = useCallback((_: any, node: any) => setHoveredNode(node.id), []);
  const onNodeMouseLeave = useCallback(() => setHoveredNode(null), []);
  const onEdgeMouseEnter = useCallback((_: any, edge: any) => setHoveredEdge(edge.id), []);
  const onEdgeMouseLeave = useCallback(() => setHoveredEdge(null), []);

  // 🔹 Memoized styled nodes/edges to avoid recalculation on every render
  const visualNodes = useMemo(() => (
    nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        border: highlightedNode === n.id 
          ? "3px solid #ff6b35" 
          : hoveredNode === n.id 
            ? "2px solid #1976d2" 
            : "1px solid #90caf9",
        padding: 8,
        // color by table type (inspect details)
        background: (() => {
          if (hiddenNodes.has(n.id)) return "#e3e3e3";
          const details = n.data?.details || [];
          const t = details && details.length > 0 ? (details[0].parentTableName === n.id ? details[0].parentTableType : details[0].childTableType) : undefined;
          const color = getColorFor('table', t);
          return color || '#e3f2fd';
        })(),
        color: "#0d47a1",
        boxShadow: highlightedNode === n.id 
          ? "0 0 20px #ff6b35, 0 0 40px rgba(255, 107, 53, 0.3)" 
          : (hoveredNode === n.id || (hoveredEdge && edges.find((ee: any) => ee.id === hoveredEdge && (ee.source === n.id || ee.target === n.id))))
            ? "0 0 12px #ff9800" 
            : "0 1px 4px #90caf9",
      },
      data: {
        ...n.data,
        label: (
          <Tooltip
            title={
              <Box>
                <TooltipContent node={n} />
                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color={hiddenNodes.has(n.id) ? "success" : "error"}
                    onClick={async () => {
                      if (hiddenNodes.has(n.id)) {
                        await unhideNode(n.id);
                      } else {
                        await hideNode(n.id);
                      }
                    }}
                    sx={{ fontWeight: "bold", borderRadius: 2 }}
                  >
                    {hiddenNodes.has(n.id) ? "Unhide" : "Hide"}
                  </Button>
                </Box>
              </Box>
            }
            arrow
            placement="right"
            componentsProps={{
              tooltip: {
                sx: {
                  backgroundColor: '#ffffff',
                  color: '#0d47a1',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  padding: '8px',
                  maxWidth: 360,
                }
              },
              arrow: {
                sx: { color: '#ffffff' }
              }
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: '8px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: '500',
              lineHeight: '1.4',
              wordWrap: 'break-word',
              overflowWrap: 'anywhere',
              whiteSpace: 'normal',
              boxSizing: 'border-box',
            }}>
              {n.data.label}
            </div>
          </Tooltip>
        ),
      },
    }))
  ), [nodes, hoveredNode, hiddenNodes, hoveredEdge, edges, highlightedNode]);

  const visualEdges = useMemo(() => (
    edges.map((e) => ({
      ...e,
      style:
        hoveredEdge === e.id || (hoveredNode && (e.source === hoveredNode || e.target === hoveredNode))
          ? { ...e.style, stroke: getColorFor('relationship', String(e.label)) || '#1976d2', strokeWidth: 4 }
          : { ...e.style, stroke: getColorFor('relationship', String(e.label)) || '#90caf9', strokeWidth: 2 },
    }))
  ), [edges, hoveredNode, hoveredEdge]);

  // Memoize nodeTypes to avoid recreating the object on every render (prevents React Flow warnings)
  const nodeTypesMemo = useMemo(() => ({ fourHandle: FourHandleNode }), []);

  // Manual simplify + fit graph using external utility (for button clicks)
  const simplifyGraph = useCallback(async () => {
    const result = await simplifyFit({
      nodes,
      edges,
      hiddenNodes,
      layoutDirection,
      positions,
      setPositions,
      setNodes,
      pushHistoryAndRefresh,
      filters,
      neighborhoodNodes,
      selectedNeighborhoodNodes,
      currentNeighborhoodFilterNodeId,
      debouncedSaveGraphState,
      data,
      filteredData,
      fitView,
      fitViewOptions: { duration: 800 }
    });
    
    if (!result.success) {
      console.warn('Simplify graph failed:', result.message);
    }
  }, [nodes, edges, hiddenNodes, layoutDirection, positions, setPositions, setNodes, pushHistoryAndRefresh, filters, neighborhoodNodes, selectedNeighborhoodNodes, currentNeighborhoodFilterNodeId, debouncedSaveGraphState, data, filteredData, fitView]);

  // Handle node selection from search
  const handleNodeSearch = useCallback((nodeId: string) => {
    setHighlightedNode(nodeId);
    // Clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedNode(null);
    }, 3000);
  }, []);

  // Handle reset filters
  const handleResetFilters = useCallback(async () => {
    const resetFilters = Object.fromEntries(Object.keys(filters).map(key => [key, []])); 
    setFilters(resetFilters); 
    setNeighborhoodNodes([]);
    setSelectedNeighborhoodNodes([]);
    setCurrentNeighborhoodFilterNodeId(null);
    try { localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(resetFilters)); } catch { }
    setTimeout(() => {
      fitView({ duration: 800 });
    }, 200); // Give time for state updates
  }, [filters, getStorageKey, setFilters, setNeighborhoodNodes, setSelectedNeighborhoodNodes, fitView]);

  // Undo handler
  const handleUndo = useCallback(async () => {
    // Set flag to prevent auto-simplify during and after undo
    setIsUndoRedoOperation(true);
    
    try {
      const entry = await undoHistory(fileKey ?? null);
      if (!entry) return;
      setFilters(entry.filters || {});
      setLayoutDirection(entry.layoutDirection || 'TB');
      setHiddenNodes(new Set(entry.hidden || []));
      setPositions(entry.positions || {});
      setNeighborhoodNodes(entry.neighborhoodNodes || []);
      setSelectedNeighborhoodNodes(entry.selectedNeighborhoodNodes || []);
      setCurrentNeighborhoodFilterNodeId(entry.currentNeighborhoodFilterNodeId || null);
      setNodes((prev) => prev.map((pn) => (
        entry.positions && entry.positions[pn.id]
          ? { ...pn, position: entry.positions[pn.id] }
          : pn
      )));
      // Save the restored state to localStorage
      try {
        localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(entry.filters || {}));
        localStorage.setItem(getStorageKey('graph_layout_direction'), entry.layoutDirection || 'TB');
      } catch { }
      // After restoring, just fit to screen (no auto-simplify)
      setTimeout(() => {
        try { fitView({ duration: 800 }); } catch { }
        // Clear the flag after fit is complete
        setTimeout(() => setIsUndoRedoOperation(false), 1000);
      }, 200);
    } finally {
      refreshCanUndo();
    }
  }, [fileKey, getStorageKey, setFilters, setLayoutDirection, setHiddenNodes, setPositions, setNeighborhoodNodes, setSelectedNeighborhoodNodes, setNodes, refreshCanUndo, fitView, setIsUndoRedoOperation]);

  // Redo handler
  const handleRedo = useCallback(async () => {
    // Set flag to prevent auto-simplify during and after redo
    setIsUndoRedoOperation(true);
    
    try {
      const entry = await redoHistory(fileKey ?? null);
      if (!entry) return;
      setFilters(entry.filters || {});
      setLayoutDirection(entry.layoutDirection || 'TB');
      setHiddenNodes(new Set(entry.hidden || []));
      setPositions(entry.positions || {});
      setNeighborhoodNodes(entry.neighborhoodNodes || []);
      setSelectedNeighborhoodNodes(entry.selectedNeighborhoodNodes || []);
      setCurrentNeighborhoodFilterNodeId(entry.currentNeighborhoodFilterNodeId || null);
      setNodes((prev) => prev.map((pn) => (
        entry.positions && entry.positions[pn.id]
          ? { ...pn, position: entry.positions[pn.id] }
          : pn
      )));
      // Save the restored state to localStorage
      try {
        localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(entry.filters || {}));
        localStorage.setItem(getStorageKey('graph_layout_direction'), entry.layoutDirection || 'TB');
      } catch { }
      // After restoring, just fit to screen (no auto-simplify)
      setTimeout(() => {
        try { fitView({ duration: 800 }); } catch { }
        // Clear the flag after fit is complete
        setTimeout(() => setIsUndoRedoOperation(false), 1000);
      }, 200);
    } finally {
      refreshCanUndo();
    }
  }, [fileKey, getStorageKey, setFilters, setLayoutDirection, setHiddenNodes, setPositions, setNeighborhoodNodes, setSelectedNeighborhoodNodes, setNodes, refreshCanUndo, fitView, setIsUndoRedoOperation]);

  return (
    <>
      {/* Fullscreen Graph Mode */}
      {isFullscreen && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#fff',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInScale 0.3s ease-out',
          '@keyframes fadeInScale': {
            '0%': {
              opacity: 0,
              transform: 'scale(0.95)',
            },
            '100%': {
              opacity: 1,
              transform: 'scale(1)',
            },
          },
        }}>
          {/* Fullscreen Controls */}
          <Box sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1400,
            display: 'flex',
            gap: 1,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            {/* Undo/Redo/PNG/Close buttons */}
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: canUndo ? '#1976d2' : '#ccc',
                color: '#fff',
                border: 'none',
                padding: '8px',
                borderRadius: 6,
                cursor: canUndo ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease-in-out',
                minWidth: '36px',
                height: '36px',
              }}
              title="Undo"
            >
              <UndoOutlined fontSize="small" />
            </button>
            
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: canRedo ? '#1976d2' : '#ccc',
                color: '#fff',
                border: 'none',
                padding: '8px',
                borderRadius: 6,
                cursor: canRedo ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease-in-out',
                minWidth: '36px',
                height: '36px',
              }}
              title="Redo"
            >
              <RedoOutlined fontSize="small" />
            </button>

            <button
              onClick={async () => {
                const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
                if (!viewportEl) return;
                try {
                  const { toPng } = await import('html-to-image');
                  const dataUrl = await toPng(viewportEl, {
                    backgroundColor: '#ffffff',
                    cacheBust: true,
                    pixelRatio: 2,
                    filter: (node) => {
                      return !(node.nodeType === 1 && (node as HTMLElement).style.backgroundColor === 'black');
                    },
                    style: {
                      backgroundColor: '#ffffff !important',
                    }
                  });
                  const a = document.createElement('a');
                  a.setAttribute('download', (fileKey ? `graph-${fileKey}` : 'graph') + '.png');
                  a.setAttribute('href', dataUrl);
                  a.click();
                } catch (e) {
                  console.warn('Image export failed', e);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease-in-out',
              }}
              title="Download PNG snapshot"
            >
              <DownloadOutlinedIcon fontSize="small" /> PNG
            </button>

            {/* Close button */}
            <Button
              variant="contained"
              onClick={() => {
                setIsAnimating(true);
                setTimeout(() => {
                  setIsFullscreen(false);
                  // Increment refresh key to force complete re-mount of normal ReactFlow
                  setRefreshKey(prev => prev + 1);
                  // Force complete re-initialization of the normal ReactFlow
                  setTimeout(() => {
                    try {
                      // First, update nodes to force a re-render
                      setNodes(prev => [...prev]);
                      setEdges(prev => [...prev]);
                      // Then fit view
                      setTimeout(() => {
                        try {
                          fitView({ duration: 500 });
                        } catch (error) {
                          console.warn('fitView failed, trying again:', error);
                          // Retry once more in case the normal ReactFlow wasn't ready
                          setTimeout(() => {
                          try {
                            fitView({ duration: 500 });
                          } catch (retryError) {
                            console.warn('fitView retry failed:', retryError);
                          }
                        }, 300);
                      }
                    }, 100);
                  } catch (error) {
                    console.warn('Re-render failed:', error);
                  }
                  setIsAnimating(false);
                }, 50);
                }, 150);
              }}
              sx={{
                minWidth: 'auto',
                width: 40,
                height: 40,
                backgroundColor: '#d32f2f',
                '&:hover': { backgroundColor: '#b71c1c' },
              }}
            >
              <CloseIcon />
            </Button>
          </Box>
          
          {/* Search Node below top controls */}
          <Box sx={{
            position: 'absolute',
            top: 70,
            right: 16,
            zIndex: 1400,
          }}>
            <SearchNode 
              nodes={nodes}
              hiddenNodes={hiddenNodes}
              onNodeSelect={handleNodeSearch}
            />
          </Box>
          
          {/* Controls panel moved to left side for fullscreen */}
          <Box sx={{ 
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1400,
            display: 'flex', 
            gap: 1, 
            flexDirection: 'column',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: 2,
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Neighborhood Dropdown */}
            <Box sx={{ minWidth: 260 }}>
              <FilterSelect
                title="Neighborhood"
                options={neighborhoodOptions}
                value={selectedNeighborhoodNodes}
                onChange={async (vals) => {
                  const newSelectedNeighborhoodNodes = vals || [];
                  let newNeighborhoodNodes: string[] = [];
                  let newCurrentNeighborhoodFilterNodeId: string | null = null;
                  
                  setSelectedNeighborhoodNodes(newSelectedNeighborhoodNodes);
                  
                  if (!vals || vals.length === 0) {
                    setNeighborhoodNodes([]);
                    setCurrentNeighborhoodFilterNodeId(null);
                    // After clearing neighborhood filter, just fit to screen
                    setTimeout(() => {
                      try { fitView({ duration: 800 }); } catch { }
                    }, 200);
                  } else {
                    // Build complete neighborhood for all selected nodes
                    const completeNeighborhood = new Set<string>();
                    
                    vals.forEach(nodeId => {
                      // Add the selected node itself
                      completeNeighborhood.add(nodeId);
                      
                      // Get complete lineage for each selected node
                      const { parents, children } = getImmediateFamily(nodeId);
                      
                      // Add immediate parents and children
                      parents.forEach(parent => completeNeighborhood.add(parent));
                      children.forEach(child => completeNeighborhood.add(child));
                    });
                    
                    newNeighborhoodNodes = Array.from(completeNeighborhood);
                    newCurrentNeighborhoodFilterNodeId = vals.length === 1 ? vals[0] : null;
                    
                    setNeighborhoodNodes(newNeighborhoodNodes);
                    setCurrentNeighborhoodFilterNodeId(newCurrentNeighborhoodFilterNodeId);
                  }
                  
                  // Do not push history here; atomic simplify sequence will save once at the end
                  
                  setTimeout(() => {
                    fitView({ duration: 800 });
                  }, 200); // Give time for state updates
                }}
              />
            </Box>
          </Box>
          
          {/* Fullscreen ReactFlow */}
          <ReactFlow
            key="fullscreen-reactflow"
            nodes={visualNodes}
            edges={visualEdges}
            onNodesChange={handleNodesChange}
            onNodeDragStop={nodeManualOps.onNodeDragStop}
            onEdgesChange={onEdgesChange}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            nodeTypes={nodeTypesMemo}
            minZoom={0.001}
            maxZoom={5}
            fitView
            style={{ width: '100%', height: '100%' }}
          >
            <Background color="#e3f2fd" />
            <AnimatedControls 
              style={{ background: "#e3f2fd", borderRadius: 8 }} 
              onResetFilters={handleResetFilters}
              onSimplify={simplifyGraph}
            />
            <MiniMap
              nodeColor={(n) => (hiddenNodes.has(n.id) ? "#bdbdbd" : "#1976d2")}
              nodeStrokeColor={(n) => (hoveredNode === n.id ? "#ff9800" : "#1976d2")}
              maskColor="rgba(33,150,243,0.1)"
            />
          </ReactFlow>
        </Box>
      )}
      
      {/* Normal Layout */}
      <div style={{ width: '100vw', background: PEPSI_LIGHT }}>

      {/* Header ribbon (larger) */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, background: '#fff', boxShadow: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: PEPSI_BLUE }}>Lineage Visualization</Typography>
        <Box>
          <img src={logo} alt="logo" style={{ height: 56 }} />
        </Box>
      </Box>

      {/* Filters ribbon */}
      <Box sx={{ px: 3, py: 2, background: PEPSI_BG_LIGHT, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {columns.map((col) => (
            <Box key={col} sx={{ minWidth: 220 }}>
              <FilterSelect
                title={col}
                options={filterOptions[col] || []}
                value={filters[col] || []}
                onChange={async (vals) => {
                  const newFilters = { ...filters, [col]: vals };
                  setFilters(newFilters);
                  
                  try { localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(newFilters)); } catch { }
                  
                  // Calculate new filtered data manually with the updated filters
                  const baseFiltered = data.filter((row) =>
                    Object.entries(newFilters).every(([colKey, val]) => {
                      if (!val || (Array.isArray(val) && val.length === 0)) return true;
                      if (Array.isArray(val)) return val.includes(String(row[colKey]));
                      return String(row[colKey]) === val;
                    })
                  );
                  
                  const newFilteredData = !neighborhoodNodes || neighborhoodNodes.length === 0 
                    ? baseFiltered 
                    : baseFiltered.filter((row) => {
                        const allowedNodes = new Set(neighborhoodNodes);
                        return allowedNodes.has(row.parentTableName) && allowedNodes.has(row.childTableName);
                      });
                  
                  // Persist node positions & filteredOut with new filtered data
                  const liveNodePositions = Object.fromEntries(nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
                  const fullSnapshot = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
                  try { saveGraphStateImmediate(fullSnapshot, hiddenNodes, data, newFilteredData); } catch { }
                  
                  // Do not push history here; atomic simplify sequence will save once at the end
                  
                  // Fit view after filter change
                  setTimeout(() => {
                    fitView({ duration: 800 });
                  }, 200); // Give time for state updates
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Neighborhood ribbon (below filters) */}
      <Box sx={{ px: 3, py: 2, background: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ minWidth: 300 }}>
              <FilterSelect
                title="Neighborhood"
                options={neighborhoodOptions}
                value={selectedNeighborhoodNodes}
                onChange={async (vals) => {
                  const newSelectedNeighborhoodNodes = vals || [];
                  let newNeighborhoodNodes: string[] = [];
                  let newCurrentNeighborhoodFilterNodeId: string | null = null;
                  
                  setSelectedNeighborhoodNodes(newSelectedNeighborhoodNodes);
                  
                  if (!vals || vals.length === 0) {
                    setNeighborhoodNodes([]);
                    setCurrentNeighborhoodFilterNodeId(null);
                    // After clearing neighborhood filter, just fit to screen
                    setTimeout(() => {
                      try { fitView({ duration: 800 }); } catch { }
                    }, 200);
                  } else {
                    // Build complete neighborhood for all selected nodes
                    const completeNeighborhood = new Set<string>();
                    
                    vals.forEach(nodeId => {
                      // Add the selected node itself
                      completeNeighborhood.add(nodeId);
                      
                      // Get complete lineage for each selected node
                      const { parents, children } = getImmediateFamily(nodeId);
                      
                      // Add all ancestors and descendants
                      parents.forEach(parent => completeNeighborhood.add(parent));
                      children.forEach(child => completeNeighborhood.add(child));
                    });
                    
                    newNeighborhoodNodes = Array.from(completeNeighborhood);
                    newCurrentNeighborhoodFilterNodeId = vals.length === 1 ? vals[0] : null;
                    
                    setNeighborhoodNodes(newNeighborhoodNodes);
                    setCurrentNeighborhoodFilterNodeId(newCurrentNeighborhoodFilterNodeId);
                  }
                  
                  // Do not push history here; atomic simplify sequence will save once at the end
                  
                  // Fit view after neighborhood change
                  setTimeout(() => {
                    fitView({ duration: 800 });
                  }, 200); // Give time for state updates
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: '#666' }}>{selectedNeighborhoodNodes && selectedNeighborhoodNodes.length > 0 ? `Neighborhood: ${selectedNeighborhoodNodes.join(', ')}` : 'Showing all nodes'}</Typography>
          </Box>
          <Button variant="contained" onClick={handleResetFilters} sx={{ fontWeight: 'bold', backgroundColor: PEPSI_BLUE, '&:hover': { backgroundColor: '#00356a' } }}>
            <SettingsBackupRestoreOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Reset All Filters
          </Button>
        </Box>
      </Box>

      {/* Hidden nodes + Unhide Selected ribbon */}
      <Box sx={{ px: 3, py: 2, background: PEPSI_BG_LIGHT, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <Box sx={{ minWidth: 320 }}>
              <FilterSelect
                title="Hidden Nodes"
                options={Array.from(hiddenNodes)}
                value={selectedHidden}
                onChange={(vals) => setSelectedHidden(vals)}
                placeholderAllText="All"
              />
            </Box>
            <Button variant="contained" color="success" disabled={selectedHidden.length === 0} onClick={async () => { 
              for (const id of selectedHidden) {
                await unhideNode(id);
              }
              setSelectedHidden([]); 
            }} sx={{ fontWeight: 'bold' }}>Unhide Selected</Button>
          </Box>
          <Button variant="contained" onClick={resetHiddenNodes} sx={{ fontWeight: 'bold', backgroundColor: '#4CAF50', '&:hover': { backgroundColor: '#388e3c' } }}>
            <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Reset Hidden Nodes
          </Button>
        </Box>
      </Box>

      {/* Buttons ribbon (core actions) */}
      <Box sx={{ px: 3, py: 2, background: '#fff', display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography
            variant="body2"
            sx={{
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontStyle: 'italic'
            }}
          >
            💡 Tip: Right-click on any node to filter its neighborhood (right-click again to reset)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/')} sx={{ fontWeight: 'bold', backgroundColor: '#0055A4', color: '#fff', '&:hover': { backgroundColor: '#004080' } }}>
            <UploadFileOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Upload CSV
          </Button>
          <Button variant="contained" onClick={() => { simplifyGraph() }} sx={{ fontWeight: 'bold', backgroundColor: PEPSI_BLUE, '&:hover': { backgroundColor: '#00356a' } }}>
            <AutoAwesomeOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Simplify Graph
          </Button>
        </Box>
      </Box>

      {/* Legend + layout / history controls */}
      <Box sx={{ px: 3, py: 2, background: '#f9fbff', borderTop: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#333' }}>Table Types</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.keys(tableTypeMap).length === 0 && <Typography variant="body2" sx={{ color: '#666' }}>No table types</Typography>}
                {Object.entries(tableTypeMap).map(([t, c]) => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 16, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 6, background: c }} />
                    <span style={{ fontSize: 13, color: '#222' }}>{t}</span>
                  </label>
                ))}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#333' }}>Relationship Types</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.keys(relTypeMap).length === 0 && <Typography variant="body2" sx={{ color: '#666' }}>No relationship types</Typography>}
                {Object.entries(relTypeMap).map(([t, c]) => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 16, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 6, background: c }} />
                    <span style={{ fontSize: 13, color: '#222' }}>{t}</span>
                  </label>
                ))}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#333' }}>Line Types</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#fff', padding: '6px 10px', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <svg width="36" height="12" viewBox="0 0 36 12" xmlns="http://www.w3.org/2000/svg">
                    <line x1="2" y1="6" x2="34" y2="6" stroke="#444" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <Typography variant="body2" sx={{ color: '#333' }}>Direct relationship</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#fff', padding: '6px 10px', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <svg width="36" height="12" viewBox="0 0 36 12" xmlns="http://www.w3.org/2000/svg">
                    <line x1="2" y1="6" x2="34" y2="6" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
                  </svg>
                  <Typography variant="body2" sx={{ color: '#333' }}>Indirect relationship</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" disabled={!canUndo} onClick={async () => {
                try {
                  const entry = await undoHistory(fileKey ?? null);
                  if (!entry) return;
                  setFilters(entry.filters || {});
                  setLayoutDirection(entry.layoutDirection || 'TB');
                  setHiddenNodes(new Set(entry.hidden || []));
                  setPositions(entry.positions || {});
                  setNeighborhoodNodes(entry.neighborhoodNodes || []);
                  setSelectedNeighborhoodNodes(entry.selectedNeighborhoodNodes || []);
                  setCurrentNeighborhoodFilterNodeId(entry.currentNeighborhoodFilterNodeId || null);
                  setNodes((prev) => prev.map((pn) => (
                    entry.positions && entry.positions[pn.id]
                      ? { ...pn, position: entry.positions[pn.id] }
                      : pn
                  )));
                  // Save the restored state to localStorage
                  try {
                    localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(entry.filters || {}));
                    localStorage.setItem(getStorageKey('graph_layout_direction'), entry.layoutDirection || 'TB');
                  } catch { }
                } finally {
                  refreshCanUndo();
                }
              }} sx={{ fontWeight: 'bold' }}>Undo</Button>
              <Button variant="outlined" disabled={!canRedo} onClick={async () => {
                try {
                  const entry = await redoHistory(fileKey ?? null);
                  if (!entry) return;
                  setFilters(entry.filters || {});
                  setLayoutDirection(entry.layoutDirection || 'TB');
                  setHiddenNodes(new Set(entry.hidden || []));
                  setPositions(entry.positions || {});
                  setNeighborhoodNodes(entry.neighborhoodNodes || []);
                  setSelectedNeighborhoodNodes(entry.selectedNeighborhoodNodes || []);
                  setCurrentNeighborhoodFilterNodeId(entry.currentNeighborhoodFilterNodeId || null);
                  setNodes((prev) => prev.map((pn) => (
                    entry.positions && entry.positions[pn.id]
                      ? { ...pn, position: entry.positions[pn.id] }
                      : pn
                  )));
                  // Save the restored state to localStorage
                  try {
                    localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(entry.filters || {}));
                    localStorage.setItem(getStorageKey('graph_layout_direction'), entry.layoutDirection || 'TB');
                  } catch { }
                } finally {
                  refreshCanUndo();
                }
              }} sx={{ fontWeight: 'bold' }}>Redo</Button>
            </Box>
            <LayoutDirection
              value={layoutDirection}
              onChange={(d) => setLayoutDirection(d)}
              onApply={async () => {
                const visibleNodes = nodes.filter(n => !hiddenNodes.has(n.id));
                const visibleEdges = edges.filter(e => !hiddenNodes.has(e.source) && !hiddenNodes.has(e.target));
                try {
                  const layouted = await getLayoutedElements(visibleNodes, visibleEdges, layoutDirection);
                  const newPositions = { ...positions };
                  layouted.nodes.forEach((n: any) => {
                    if (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number') {
                      newPositions[n.id] = { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) };
                    }
                  });
                  setPositions(newPositions);
                  setNodes((prevNodes) => prevNodes.map((pn) => {
                    const updated = layouted.nodes.find((ln: any) => ln.id === pn.id);
                    return updated ? ({ ...pn, position: updated.position } as any) : pn;
                  }));
                  const fullSnapshot = Object.fromEntries(layouted.nodes.map((n: any) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
                  try { saveGraphStateImmediate({ ...positions, ...fullSnapshot }, hiddenNodes, data, filteredData); } catch { }
                  try { await pushHistoryAndRefresh({ positions: newPositions, hidden: Array.from(hiddenNodes), filters, layoutDirection, neighborhoodNodes: [...neighborhoodNodes], timestamp: Date.now() }); } catch { }
                } catch { }
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* 🔹 Usage Note */}
      <Box sx={{ px: 2, pb: 2 }}>

      </Box>

      {/* 🔹 Graph */}
      <Box sx={{
        borderRadius: 3,
        boxShadow: 3,
        mx: 2,
        mb: 2,
        background: "#fff",
        width: 'calc(100% - 32px)',
        height: '80vh',
        position: 'relative'
      }}>
        <ReactFlow
          key={`normal-reactflow-${refreshKey}`}
          nodes={visualNodes}
          edges={visualEdges}
          onNodesChange={handleNodesChange}
          onNodeDragStop={nodeManualOps.onNodeDragStop}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          nodeTypes={nodeTypesMemo}
          minZoom={0.001}
          maxZoom={5}
          fitView
        >
          <Background color="#e3f2fd" />
          <AnimatedControls 
            style={{ background: "#e3f2fd", borderRadius: 8 }} 
            onResetFilters={handleResetFilters}
            onSimplify={simplifyGraph}
          />
          <MiniMap
            nodeColor={(n) => (hiddenNodes.has(n.id) ? "#bdbdbd" : "#1976d2")}
            nodeStrokeColor={(n) => (hoveredNode === n.id ? "#ff9800" : "#1976d2")}
            maskColor="rgba(33,150,243,0.1)"
          />
          <DownloadButton 
            fileName={(fileKey ? `graph-${fileKey}` : 'graph') + '.png'} 
            onExpandClick={() => {
              setIsAnimating(true);
              setTimeout(() => {
                setIsFullscreen(true);
                setIsAnimating(false);
              }, 150);
            }}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
          <Panel position="top-right" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '60px' }}>
            <SearchNode 
              nodes={nodes}
              hiddenNodes={hiddenNodes}
              onNodeSelect={handleNodeSearch}
            />
          </Panel>
        </ReactFlow>
      </Box>

      {/* 🔹 Visible Nodes Table */}
      <Box sx={{
        mx: 2,
        my: 4,
        overflow: "auto",
        minHeight: "50vh",
        backgroundColor: "#fff",
        borderRadius: 3,
        boxShadow: 3,
        p: 3
      }}>
        <Typography variant="h6" sx={{ mb: 3, color: "#1976d2" }}>Visible Nodes Relationships</Typography>
        <Box sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: "auto"
        }}>
          <Table size="small" sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: PEPSI_BLUE }}>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Parent Node</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Parent Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Relationship</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Child Node</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Child Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Client ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>App ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const visible = filteredData.filter(row => !hiddenNodes.has(row.parentTableName) && !hiddenNodes.has(row.childTableName));
                const totalPages = Math.max(1, Math.ceil(visible.length / rowsPerPage));
                const current = Math.min(page, totalPages);
                const start = (current - 1) * rowsPerPage;
                const pageRows = visible.slice(start, start + rowsPerPage);
                return pageRows.map((row, index) => (
                  <TableRow
                    key={start + index}
                    sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' }, '&:hover': { backgroundColor: '#e3f2fd' } }}
                  >
                    <TableCell>{row.parentTableName}</TableCell>
                    <TableCell>{row.parentTableType}</TableCell>
                    <TableCell>{row.relationship}</TableCell>
                    <TableCell>{row.childTableName}</TableCell>
                    <TableCell>{row.childTableType}</TableCell>
                    <TableCell>{row.ClientID}</TableCell>
                    <TableCell>{row.AppID}</TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </Box>

        {/* Pagination controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Box>
            <Button variant="outlined" size="small" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} sx={{ mr: 1 }}>Prev</Button>
            <Button variant="outlined" size="small" onClick={() => setPage((p) => p + 1)} disabled={filteredData.filter(row => !hiddenNodes.has(row.parentTableName) && !hiddenNodes.has(row.childTableName)).length <= page * rowsPerPage}>Next</Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Page</Typography>
            <Select value={page} size="small" onChange={(e) => setPage(Number(e.target.value))}>
              {Array.from({ length: Math.max(1, Math.ceil(filteredData.filter(row => !hiddenNodes.has(row.parentTableName) && !hiddenNodes.has(row.childTableName)).length / rowsPerPage)) }).map((_, i) => (
                <MenuItem key={i + 1} value={i + 1}>{i + 1}</MenuItem>
              ))}
            </Select>
          </Box>
        </Box>
      </Box>
      </div>
    </>
  );
};

const Graph = ({ data, fileKey }: { data: TableRelation[]; fileKey?: string | null }) => (
  <ReactFlowProvider>
    <GraphInner data={data} fileKey={fileKey} />
  </ReactFlowProvider>
);

export default Graph;
