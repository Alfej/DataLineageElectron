import React, { useEffect, useState, useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  MarkerType,
  Node,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { Tooltip, Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem } from "@mui/material";

const nodeWidth = 180;
const nodeHeight = 50;

interface TableRelation {
  parentTableName: string;
  childTableName: string;
  parentTableType: string;
  childTableType: string;
  relationship: string;
  ClientID: string;
  AppID: string;
  [key: string]: any; // extra CSV columns
}

const getLayoutedElements = (nodes: Node[], edges: any[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

const Graph = ({ data }: { data: TableRelation[] }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 🔹 Filters
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [columns, setColumns] = useState<string[]>([]);

  // Extract dynamic column names (from first row)
  useEffect(() => {
    if (data && data.length > 0) {
      const cols = Object.keys(data[0]);
      setColumns(cols);

      const initFilters: { [key: string]: string } = {};
      cols.forEach((c) => (initFilters[c] = ""));
      setFilters(initFilters);
    }
  }, [data]);

  // Apply filters on data
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      return Object.entries(filters).every(([col, val]) => {
        if (!val) return true;
        return String(row[col]) === val;
      });
    });
  }, [data, filters]);

  // Build available filter options dynamically
  const filterOptions = useMemo(() => {
    const opts: { [key: string]: string[] } = {};
    columns.forEach((col) => {
      const values = new Set<string>();
      data.forEach((row) => {
        const passes = Object.entries(filters).every(([fCol, val]) => {
          if (!val || fCol === col) return true;
          return String(row[fCol]) === val;
        });
        if (passes && row[col]) values.add(String(row[col]));
      });
      opts[col] = Array.from(values);
    });
    return opts;
  }, [data, filters, columns]);

  // Build nodes & edges from filtered data
  useEffect(() => {
    if (!filteredData || filteredData.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const nodeMap: Record<string, boolean> = {};
    const createdNodes: any[] = [];
    const createdEdges: any[] = [];

    filteredData.forEach((row, index) => {
      const child = row.childTableName?.trim();
      const parent = row.parentTableName?.trim();
      const relationship = row.relationship?.trim();

      if (!child || !parent) return;

      if (!nodeMap[child]) {
        nodeMap[child] = true;
        createdNodes.push({
          id: child,
          data: {
            label: `${child} (${row.childTableType})`,
            details: filteredData.filter(
              (rel) =>
                rel.childTableName === child || rel.parentTableName === child
            ),
          },
          position: { x: 0, y: 0 },
          style: {
            padding: 10,
            borderRadius: "8px",
            border: "1px solid #999",
            background: "#fff",
          },
        });
      }

      if (!nodeMap[parent]) {
        nodeMap[parent] = true;
        createdNodes.push({
          id: parent,
          data: {
            label: `${parent} (${row.parentTableType})`,
            details: filteredData.filter(
              (rel) =>
                rel.childTableName === parent || rel.parentTableName === parent
            ),
          },
          position: { x: 0, y: 0 },
          style: {
            padding: 10,
            borderRadius: "8px",
            border: "1px solid #999",
            background: "#fff",
          },
        });
      }

      createdEdges.push({
        id: `e-${child}-${parent}-${index}`,
        source: child,
        target: parent,
        label: relationship,
        style: { strokeWidth: 2, stroke: "#444" },
        labelStyle: { fill: "#333", fontWeight: 600, fontSize: 12 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: "#444",
        },
      });
    });

    const layouted = getLayoutedElements(createdNodes, createdEdges);

    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
  }, [filteredData]);

  const onNodeMouseEnter = useCallback((_: any, node: any) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {/* 🔹 Dynamic Filters */}
      <Grid container spacing={2} sx={{ p: 2 }}>
        {columns.map((col) => (
          <Grid item xs={2} key={col}>
            <FormControl fullWidth>
              <InputLabel>{col}</InputLabel>
              <Select
                value={filters[col] || ""}
                label={col}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, [col]: e.target.value }))
                }
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions[col]?.map((val) => (
                  <MenuItem key={val} value={val}>
                    {val}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        ))}
      </Grid>

      {/* Graph */}
      <ReactFlow
        nodes={nodes.map((n) => {
          const tooltipContent = (
            <Box sx={{ p: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {n.data.label}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Relationships:
              </Typography>
              {n.data.details?.map((detail: TableRelation, idx: number) => (
                <Box key={idx} sx={{ ml: 1, mt: 0.5 }}>
                  <Typography variant="body2">
                    {detail.childTableName === n.id
                      ? `Child → Parent: ${detail.parentTableName}`
                      : `Parent → Child: ${detail.childTableName}`}
                  </Typography>
                  <Typography variant="body2">
                    • Relationship: {detail.relationship}
                  </Typography>
                  <Typography variant="body2">
                    • Client ID: {detail.ClientID}
                  </Typography>
                  <Typography variant="body2">
                    • App ID: {detail.AppID}
                  </Typography>
                </Box>
              ))}
            </Box>
          );

          return {
            ...n,
            style:
              hoveredNode === n.id
                ? { ...n.style, border: "2px solid #ff0072" }
                : n.style,
            data: {
              ...n.data,
              label: (
                <Tooltip title={tooltipContent} arrow placement="right">
                  <span>{n.data.label}</span>
                </Tooltip>
              ),
            },
          };
        })}
        edges={edges.map((e) => ({
          ...e,
          style:
            hoveredNode && e.source === hoveredNode
              ? { ...e.style, stroke: "#ff0072", strokeWidth: 3 }
              : e.style,
        }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default Graph;
