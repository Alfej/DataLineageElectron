import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';
import { parseCsvFile } from '../utils/parseCSV';
import { TableRelation } from '../components/graph/graphModel';
import { Box, Button } from '@mui/material';
import { HierarchyLevel, transformRelations } from '../utils/hierarchyTransform';

export default function GraphPage() {
  const { fileKey } = useParams<{ fileKey: string }>();
  const navigate = useNavigate();
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [data, setData] = useState<TableRelation[]>([]);
  const [loading, setLoading] = useState(true);
  // Hierarchy level state with persistence by fileKey
  const storageKey = fileKey ? `hierarchy_level::${decodeURIComponent(fileKey)}` : 'hierarchy_level::default';
  const [level, setLevel] = useState<HierarchyLevel>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return (saved as HierarchyLevel) || 'Sector';
    } catch { return 'Sector'; }
  });

  useEffect(() => {
    const load = async () => {
      if (!fileKey) return;
      const decoded = decodeURIComponent(fileKey);
      // First, try uploaded_csv::<key>
      const csvStored = localStorage.getItem(`uploaded_csv::${decoded}`);
      if (csvStored) {
        try {
          const parsed = JSON.parse(csvStored);
          setRawRows(parsed as any[]);
          setData(transformRelations(parsed as any[], level));
          setLoading(false);
          return;
        } catch (e) {
          // fallthrough
        }
      }

      // Next, try to find a saved raw CSV path or graph_node_state scoped to this fileKey
      // If there is a graph_node_state::<fileKey> it is position data; we still need the CSV rows.
      // Try to locate any localStorage key that includes the fileKey and contains a CSV-like array
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) as string;
        if (!k) continue;
        if (k.includes(decoded) && k.startsWith('uploaded_csv::')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) as string);
            setRawRows(parsed as any[]);
            setData(transformRelations(parsed as any[], level));
            setLoading(false);
            return;
          } catch {}
        }
      }

      // As a last resort, try to load the default bundled CSV
      try {
        // Load new default CSV path
        const defaultRows = await parseCsvFile('data/final_output.csv');
        setRawRows(defaultRows as any[]);
        setData(transformRelations(defaultRows as any[], level));
      } catch (e) {
        setRawRows([]);
        setData([]);
      }
      setLoading(false);
    };
    load();
  }, [fileKey]);

  // Recompute on level change
  useEffect(() => {
    try { localStorage.setItem(storageKey, level); } catch {}
    if (rawRows && rawRows.length) {
      setData(transformRelations(rawRows, level));
    }
  }, [level]);

  if (loading) return <Box sx={{ p: 4 }}>Loading...</Box>;
  if (!fileKey) return <Box sx={{ p: 4 }}>No file selected. <Button onClick={() => navigate('/landingPage')}>Back</Button></Box>;

  const decodedKey = decodeURIComponent(fileKey);
  return (
    <Box sx={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Graph data={data} fileKey={decodedKey} hierarchyLevel={level} onHierarchyLevelChange={setLevel} />
      </Box>
    </Box>
  );
}
