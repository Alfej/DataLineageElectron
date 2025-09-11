import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';
import { parseCsvFile } from '../utils/parseCSV';
import { TableRelation } from '../components/graph/graphModel';
import { Box, Button } from '@mui/material';

export default function GraphPage() {
  const { fileKey } = useParams<{ fileKey: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TableRelation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!fileKey) return;
      const decoded = decodeURIComponent(fileKey);
      // First, try uploaded_csv::<key>
      const csvStored = localStorage.getItem(`uploaded_csv::${decoded}`);
      if (csvStored) {
        try {
          const parsed = JSON.parse(csvStored);
          setData(parsed as TableRelation[]);
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
            setData(parsed as TableRelation[]);
            setLoading(false);
            return;
          } catch {}
        }
      }

      // As a last resort, try to load the default bundled CSV
      try {
        const defaultRows = await parseCsvFile('data/data.csv');
        setData(defaultRows as TableRelation[]);
      } catch (e) {
        setData([]);
      }
      setLoading(false);
    };
    load();
  }, [fileKey]);

  if (loading) return <Box sx={{ p: 4 }}>Loading...</Box>;
  if (!fileKey) return <Box sx={{ p: 4 }}>No file selected. <Button onClick={() => navigate('/landingPage')}>Back</Button></Box>;

  return (
    <Box sx={{ width: '100vw', height: '100vh' }}>
      <Graph data={data} fileKey={decodeURIComponent(fileKey)} />
    </Box>
  );
}
