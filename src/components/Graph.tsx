import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import {  } from "@mui/material";
import {
  Tooltip,
  Box,
  Typography,

  FormControl,
  InputLabel,
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
import TooltipContent from './graph/TooltipContent';
import logo from '../assets/PepsiCoLogo.png';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SettingsBackupRestoreOutlinedIcon from '@mui/icons-material/SettingsBackupRestoreOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

// PepsiCo palette
const PEPSI_BLUE = '#004B93';
const PEPSI_LIGHT = '#BCC5E1';
const PEPSI_BG_LIGHT = '#EAF3FF';

// GraphModel provides traversal utilities for the data
// TooltipContent renders node tooltip details

const Graph = ({ data, fileKey }: { data: TableRelation[]; fileKey?: string | null }) => {
  const getStorageKey = (base: string) => (fileKey ? `${base}::${fileKey}` : base);
  const nodeWidth = 180;

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
    } catch {}
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

  // Neighborhood filter (multi-select: choose nodes to focus on their immediate parents + children)
  const [neighborhoodNodes, setNeighborhoodNodes] = useState<string[]>([]);

  // Pagination for the table
  const [page, setPage] = useState<number>(1);
  const rowsPerPage = 10;

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
  const resetHiddenNodes = () => {
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
  };
  // 🔹 Right-click to hide node
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    if (!hiddenNodes.has(node.id)) hideNode(node.id);
  }, [hiddenNodes]);

  // 🔹 Extract dynamic columns and initialize/restore filters
  useEffect(() => {
    if (data.length > 0) {
  // register any new table/relationship types and assign colors
  try { registerTypesFromData(data as any[]); } catch {}
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
    }
  }, [data]);

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
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: getColorFor('relationship', relationship) || '#444' },
        });
      });

      const layouted = getLayoutedElements(createdNodes, createdEdges);
      setPositions(
        layouted.nodes.reduce((acc: any, node: any) => {
          acc[node.id] = node.position;
          return acc;
        }, {})
      );

      // Save to localStorage for future loads (file-scoped)
      const state: Record<string, any> = {};
      layouted.nodes.forEach((n: any) => {
        const px = n.position && typeof n.position.x === 'number' ? Number(n.position.x) : 0;
        const py = n.position && typeof n.position.y === 'number' ? Number(n.position.y) : 0;
        // parents: rows where childTableName === node.id
        const parents = data.filter((d) => d.childTableName === n.id).map((d) => d.parentTableName);
        const children = data.filter((d) => d.parentTableName === n.id).map((d) => d.childTableName);
        state[n.id] = {
          id: n.id,
          x: px,
          y: py,
          parents,
          children,
          hidden: false,
          filteredOut: false,
        };
      });
      try {
        // persist using the unified save helper so shape is consistent
        const positionsSnapshot = Object.fromEntries(layouted.nodes.map((n: any) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
        saveGraphStateImmediate(positionsSnapshot, new Set(), data, filteredData);
      } catch { }
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
    // Build rows that directly connect any selected node to its immediate parents or immediate children.
    const gm = graphModelRef.current;
    // For each selected node, collect its immediate parents and children
    const sel = neighborhoodNodes;
    const parentMap: Record<string, string[]> = {};
    const childMap: Record<string, string[]> = {};
    if (gm) {
      sel.forEach((s) => {
        parentMap[s] = gm.getParents(s);
        childMap[s] = gm.getChildren(s);
      });
    } else {
      sel.forEach((s) => {
        parentMap[s] = [];
        childMap[s] = [];
        data.forEach((d) => {
          if (d.childTableName === s && d.parentTableName) parentMap[s].push(d.parentTableName);
          if (d.parentTableName === s && d.childTableName) childMap[s].push(d.childTableName);
        });
      });
    }

    return base.filter((row) => {
      // include row if it directly connects any selected node to one of its immediate neighbors
      return sel.some((s) => (
        (row.parentTableName === s && childMap[s]?.includes(row.childTableName)) ||
        (row.childTableName === s && parentMap[s]?.includes(row.parentTableName))
      ));
    });
  }, [data, filters, neighborhoodNodes]);

  // Reset page when filters/neighborhood change
  useEffect(() => setPage(1), [filters, neighborhoodNodes, data]);

  // Persist filters and latest node state whenever filters/hidden/positions/filteredData change
  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(filters));
    } catch {}

    // Save graph state immediately so reopen restores exact positions & filteredOut
    const liveNodePositions = Object.fromEntries(nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
    const fullSnapshot = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
    try { saveGraphStateImmediate(fullSnapshot, hiddenNodes, data, filteredData); } catch {}
  }, [filters, hiddenNodes, positions, filteredData]);

  // 🔹 Filter options (dependent on other selections and neighborhood)
  const filterOptions = useMemo(() => {
    const opts: { [key: string]: string[] } = {};

    columns.forEach((col) => {
      const values = new Set<string>();

      // For each row, check whether it passes current filters except for this column
      data.forEach((row) => {
        // neighborhood filter: if set, only consider rows that directly connect any selected neighborhood node to its immediate neighbors
        if (neighborhoodNodes && neighborhoodNodes.length > 0) {
          const gm = graphModelRef.current;
          const parentMap: Record<string, string[]> = {};
          const childMap: Record<string, string[]> = {};
          neighborhoodNodes.forEach((s) => {
            if (gm) {
              parentMap[s] = gm.getParents(s);
              childMap[s] = gm.getChildren(s);
            } else {
              parentMap[s] = data.filter(d => d.childTableName === s).map(d => d.parentTableName);
              childMap[s] = data.filter(d => d.parentTableName === s).map(d => d.childTableName);
            }
          });
          const isDirectNeighbourRow = neighborhoodNodes.some((s) => (
            (row.parentTableName === s && childMap[s]?.includes(row.childTableName)) ||
            (row.childTableName === s && parentMap[s]?.includes(row.parentTableName))
          ));
          if (!isDirectNeighbourRow) return;
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

  // 🔹 Hide node function
  const hideNode = (nodeId: string) => {
    // Toggle only this node's hidden flag. Do not hide parents/children.
    const positionsSnapshotBeforeHide = {
      ...positions,
      ...Object.fromEntries(nodes.map((n) => [n.id, n.position])),
    } as Record<string, { x: number; y: number }>;

    const newHidden = new Set(hiddenNodes);
    newHidden.add(nodeId);

    // Persist immediate with parents/children included
    saveGraphStateImmediate(positionsSnapshotBeforeHide, newHidden, data, filteredData);
    setPositions((prev) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const updated = { ...prev, [nodeId]: node.position };
        return updated;
      }
      return prev;
    });
    setHiddenNodes(newHidden);
  };

  // 🔹 Unhide node function
  const unhideNode = (nodeId: string) => {
    // Only unhide the single node; do not unhide parents/children automatically
    const newHidden = new Set(hiddenNodes);
    newHidden.delete(nodeId);

    const liveNodePositions = Object.fromEntries(
      nodes.map((n) => [
        n.id,
        {
          x: Number(n.position.x.toFixed(5)),
          y: Number(n.position.y.toFixed(5))
        }
      ])
    );
    const positionsSnapshotAfterUnhide = {
      ...positions,
      ...liveNodePositions,
    } as Record<string, { x: number; y: number }>;
    saveGraphStateImmediate(positionsSnapshotAfterUnhide, newHidden, data, filteredData);
    setHiddenNodes(newHidden);
  };

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

    filteredData.forEach((row, index) => {
      const { childTableName: child, parentTableName: parent, relationship } = row;
      if (!child || !parent) return;

      // Reverse: treat parent as child, child as parent
      if (!hiddenNodes.has(parent) && !nodeMap[parent]) {
        nodeMap[parent] = true;
        createdNodes.push({
          id: parent,
          data: {
            label: `${parent} (${row.parentTableType})`,
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
          },
        });
      }

      if (!hiddenNodes.has(child) && !nodeMap[child]) {
        nodeMap[child] = true;
        createdNodes.push({
          id: child,
          data: {
            label: `${child} (${row.childTableType})`,
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
          },
        });
      }

      if (!hiddenNodes.has(parent) && !hiddenNodes.has(child)) {
        createdEdges.push({
          id: `e-${parent}-${child}-${index}`,
          source: parent,
          target: child,
          label: relationship,
          style: { strokeWidth: 2, stroke: getColorFor('relationship', relationship) || "#444" },
          labelStyle: { fill: "#333", fontWeight: 600, fontSize: 12 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: getColorFor('relationship', relationship) || "#444",
          },
        });
      }
    });

    // Add bridging edges for hidden intermediary nodes: for each hidden node, connect its parents -> its children
    if (hiddenNodes.size > 0) {
      const hiddenArray = Array.from(hiddenNodes);
      for (const hidden of hiddenArray) {
        // Prefer using stored positions/state if available
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
            // only create if both p and c are not hidden
            if (!hiddenNodes.has(p) && !hiddenNodes.has(c)) {
              const id = `bridge-${p}-${c}`;
              if (!createdEdges.find((e) => e.id === id)) {
                // find a representative relationship type between p and hidden or hidden and c
                const relRow = data.find((d) => d.parentTableName === p && d.childTableName === hidden) || data.find((d) => d.parentTableName === hidden && d.childTableName === c);
                const rel = relRow ? relRow.relationship : '';
                createdEdges.push({
                  id,
                  source: p,
                  target: c,
                  label: rel,
                  style: { strokeWidth: 2, stroke: getColorFor('relationship', rel) || '#444', strokeDasharray: '4 4', strokeLinecap: 'round' },
                  labelStyle: { fill: '#333', fontWeight: 600, fontSize: 12 },
                  markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: getColorFor('relationship', rel) || '#444' },
                });
              }
            }
          }
        }
      }
    }

    // Only apply layout if positions are empty AND no hidden nodes (first load or filter change)
    if (Object.keys(positions).length === 0 && hiddenNodes.size === 0) {
      const layouted = getLayoutedElements(createdNodes, createdEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      // Save initial positions
      setPositions(
        layouted.nodes.reduce((acc: any, node: any) => {
          acc[node.id] = node.position;
          return acc;
        }, {})
      );
    } else {
      setNodes(createdNodes);
      setEdges(createdEdges);
    }
  }, [filteredData, hiddenNodes, positions]);

  // 🔹 Track node drag and update positions with precise coordinates
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
      // Save snapshot (debounced) and then update state
      debouncedSaveGraphState(snapshot, hiddenNodes, data, filteredData);
      setPositions((prev) => ({ ...prev, ...positionUpdates }));
    }
  }, [onNodesChange, debouncedSaveGraphState, nodes, hiddenNodes, data, filteredData]);

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
        border: hoveredNode === n.id ? "2px solid #1976d2" : "1px solid #90caf9",
        // color by table type (inspect details)
        background: (() => {
          if (hiddenNodes.has(n.id)) return "#e3e3e3";
          const details = n.data?.details || [];
          const t = details && details.length > 0 ? (details[0].parentTableName === n.id ? details[0].parentTableType : details[0].childTableType) : undefined;
          const color = getColorFor('table', t);
          return color || '#e3f2fd';
        })(),
        color: "#0d47a1",
        boxShadow: (hoveredNode === n.id || (hoveredEdge && edges.find((ee: any) => ee.id === hoveredEdge && (ee.source === n.id || ee.target === n.id)))) ? "0 0 12px #ff9800" : "0 1px 4px #90caf9",
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
                    onClick={() =>
                      hiddenNodes.has(n.id) ? unhideNode(n.id) : hideNode(n.id)
                    }
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
            <span style={{
              display: 'block',
              maxWidth: nodeWidth - 20, // Account for padding
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>{n.data.label}</span>
          </Tooltip>
        ),
      },
    }))
  ), [nodes, hoveredNode, hiddenNodes, hoveredEdge, edges]);

  const visualEdges = useMemo(() => (
    edges.map((e) => ({
      ...e,
      style:
        hoveredEdge === e.id || (hoveredNode && (e.source === hoveredNode || e.target === hoveredNode))
          ? { ...e.style, stroke: getColorFor('relationship', String(e.label)) || '#1976d2', strokeWidth: 4 }
          : { ...e.style, stroke: getColorFor('relationship', String(e.label)) || '#90caf9', strokeWidth: 2 },
    }))
  ), [edges, hoveredNode, hoveredEdge]);

  return (
    <div style={{ width: '100vw', background: PEPSI_LIGHT }}>
      {/* Header ribbon (larger) */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, background: '#fff', boxShadow: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: PEPSI_BLUE }}>Data Lineage Visualization</Typography>
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
                onChange={(vals) => {
                  setFilters((prev) => {
                    const newFilters = { ...prev, [col]: vals };
                    try { localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(newFilters)); } catch { }
                    // Persist node positions & filteredOut
                    const liveNodePositions = Object.fromEntries(nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
                    const fullSnapshot = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
                    try { saveGraphStateImmediate(fullSnapshot, hiddenNodes, data, filteredData); } catch { }
                    return newFilters;
                  });
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Neighborhood ribbon (below filters) */}
  <Box sx={{ px: 3, py: 2, background: '#fff' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ minWidth: 300 }}>
            <FilterSelect
              title="Neighborhood"
              options={neighborhoodOptions}
              value={neighborhoodNodes}
              onChange={(vals) => setNeighborhoodNodes(vals)}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#666' }}>{neighborhoodNodes && neighborhoodNodes.length > 0 ? `Neighborhood: ${neighborhoodNodes.join(', ')}` : 'Showing all nodes'}</Typography>
        </Box>
      </Box>

      {/* Hidden nodes + Unhide Selected ribbon */}
  <Box sx={{ px: 3, py: 2, background: PEPSI_BG_LIGHT, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <Box sx={{ minWidth: 320 }}>
          <FilterSelect
            title="Hidden Nodes"
            options={Array.from(hiddenNodes)}
            value={selectedHidden}
            onChange={(vals) => setSelectedHidden(vals)}
            placeholderAllText="All"
          />
        </Box>

        <Button variant="contained" color="success" disabled={selectedHidden.length === 0} onClick={() => { selectedHidden.forEach((id) => unhideNode(id)); setSelectedHidden([]); }} sx={{ fontWeight: 'bold' }}>Unhide Selected</Button>
      </Box>

      {/* Buttons ribbon */}
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
            💡 Tip: Right-click on any node to hide it from the graph
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="contained" onClick={() => { const resetFilters = Object.fromEntries(Object.keys(filters).map(key => [key, []])); setFilters(resetFilters); setNeighborhoodNodes([]); try { localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(resetFilters)); } catch { } }} sx={{ fontWeight: 'bold', backgroundColor: PEPSI_BLUE, '&:hover': { backgroundColor: '#00356a' } }}>
            <SettingsBackupRestoreOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Reset All Filters
          </Button>

          <Button variant="contained" onClick={() => {
            const liveNodePositions = Object.fromEntries(nodes.map((n) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }]));
            const fullSnapshot = { ...positions, ...liveNodePositions } as Record<string, { x: number; y: number }>;
            try { saveGraphStateImmediate(fullSnapshot, hiddenNodes, data, filteredData); } catch {}
            try { localStorage.setItem(getStorageKey('current_Filters_state'), JSON.stringify(filters)); } catch {}
          }} sx={{ fontWeight: 'bold', backgroundColor: '#FFC107', color: '#000', '&:hover': { backgroundColor: '#e0a800' } }}>
            <SaveOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Save Node Positions
          </Button>

          <Button variant="contained" onClick={resetHiddenNodes} sx={{ fontWeight: 'bold', backgroundColor: '#4CAF50', '&:hover': { backgroundColor: '#388e3c' } }}>
            <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Reset Hidden Nodes
          </Button>

          <Button variant="contained" onClick={() => { const visibleNodes = nodes.filter(n => !hiddenNodes.has(n.id)); const visibleEdges = edges.filter(e => !hiddenNodes.has(e.source) && !hiddenNodes.has(e.target)); const layouted = getLayoutedElements(visibleNodes, visibleEdges); const newPositions = { ...positions }; layouted.nodes.forEach(n => { if (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number') { newPositions[n.id] = { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }; } }); setPositions(newPositions); const layoutPos = Object.fromEntries(layouted.nodes.map((n: any) => [n.id, { x: Number(n.position.x.toFixed(5)), y: Number(n.position.y.toFixed(5)) }])); const fullSnapshot = { ...positions, ...layoutPos } as Record<string, { x: number; y: number }>; debouncedSaveGraphState(fullSnapshot, hiddenNodes, data, filteredData); }} sx={{ fontWeight: 'bold', backgroundColor: PEPSI_BLUE, '&:hover': { backgroundColor: '#00356a' } }}>
            <AutoAwesomeOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Beautify Graph
          </Button>
        </Box>
      </Box>

      {/* Type color editors */}
      <Box sx={{ px: 3, py: 2, background: '#f9fbff', borderTop: '1px solid #e0e0e0', display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Table Types</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.keys(tableTypeMap).length === 0 && <Typography variant="body2">No table types</Typography>}
            {Object.entries(tableTypeMap).map(([t, c]) => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 16, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 6, background: c }} />
                <span style={{ fontSize: 13, color: '#222' }}>{t}</span>
                {/* <input title="Pick color" type="color" value={c} disabled style={{ border: 0, background: 'transparent', padding: 0, cursor: 'default' }} /> */}
              </label>
            ))}
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Relationship Types</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.keys(relTypeMap).length === 0 && <Typography variant="body2">No relationship types</Typography>}
            {Object.entries(relTypeMap).map(([t, c]) => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 16, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 6, background: c }} />
                <span style={{ fontSize: 13, color: '#222' }}>{t}</span>
                {/* <input title="Pick color" type="color" value={c} disabled style={{ border: 0, background: 'transparent', padding: 0, cursor: 'default' }} /> */}
              </label>
            ))}
          </Box>
        </Box>
        
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Line Types</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#fff', padding: '6px 10px', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <svg width="36" height="12" viewBox="0 0 36 12" xmlns="http://www.w3.org/2000/svg">
                <line x1="2" y1="6" x2="34" y2="6" stroke="#444" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <Typography variant="body2">Direct relationship</Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#fff', padding: '6px 10px', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <svg width="36" height="12" viewBox="0 0 36 12" xmlns="http://www.w3.org/2000/svg">
                <line x1="2" y1="6" x2="34" y2="6" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
              </svg>
              <Typography variant="body2">Indirect relationship</Typography>
            </Box>
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
        width: '100%',
        height: '100vh',
        position: 'relative'
      }}>
        <ReactFlow
          nodes={visualNodes}
          edges={visualEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          fitView
        >
          <Background color="#e3f2fd" />
          <Controls style={{ background: "#e3f2fd", borderRadius: 8 }} />
          <MiniMap
            nodeColor={(n) => (hiddenNodes.has(n.id) ? "#bdbdbd" : "#1976d2")}
            nodeStrokeColor={(n) => (hoveredNode === n.id ? "#ff9800" : "#1976d2")}
            maskColor="rgba(33,150,243,0.1)"
          />
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
                <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>Parent Node</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>Parent Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>Relationship</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>Child Node</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>Child Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>Client ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>App ID</TableCell>
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
  );
};

export default Graph;
