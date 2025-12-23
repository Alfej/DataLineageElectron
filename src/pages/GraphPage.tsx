import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';
import { parseCsvFile } from '../utils/parseCSV';
import { TableRelation } from '../components/graph/graphModel';
import { getItem as getIndexedDBItem } from '../utils/indexedDB';
import { Box, Button, CircularProgress, Typography } from '@mui/material';

export default function GraphPage() {
  const { fileKey } = useParams<{ fileKey: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TableRelation[]>([]);
  const [originalData, setOriginalData] = useState<TableRelation[]>([]);
  const [initialNeighborhood, setInitialNeighborhood] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!fileKey) return;
      const decoded = decodeURIComponent(fileKey);
      
      // Try to load from IndexedDB first (for large datasets)
      try {
        // Load original unfiltered data from IndexedDB
        const originalFromDB = await getIndexedDBItem(`original::${decoded}`, 'csv');
        if (originalFromDB) {
          setOriginalData(originalFromDB as TableRelation[]);
        }
        
        // Load filtered data from IndexedDB (might not exist yet)
        const dataFromDB = await getIndexedDBItem(decoded, 'csv');
        if (dataFromDB) {
          setData(dataFromDB as TableRelation[]);
        } else {
          // No filtered data yet - user needs to select tables first
          // Set data to empty array
          setData([]);
        }
        
        // If original data wasn't found, use current data as original
        if (!originalFromDB && dataFromDB) {
          setOriginalData(dataFromDB as TableRelation[]);
        }
        
        // Load initial neighborhood filter if it exists
        try {
          const neighborhoodStored = localStorage.getItem(`initial_neighborhood::${decoded}`);
          if (neighborhoodStored) {
            const parsed = JSON.parse(neighborhoodStored);
            setInitialNeighborhood(Array.isArray(parsed) ? parsed : []);
          }
        } catch (e) {
          setInitialNeighborhood([]);
        }
        
        setLoading(false);
        return;
      } catch (e) {
        console.error('Error loading from IndexedDB:', e);
      }
      
      // Fallback: try localStorage for older/smaller files
      const csvStored = localStorage.getItem(`uploaded_csv::${decoded}`);
      if (csvStored) {
        try {
          const parsed = JSON.parse(csvStored);
          setData(parsed as TableRelation[]);
          setOriginalData(parsed as TableRelation[]);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Error parsing from localStorage:', e);
        }
      }

      // As a last resort, try to load the default bundled CSV
      try {
        const defaultRows = await parseCsvFile('data/data.csv');
        setData(defaultRows as TableRelation[]);
        setOriginalData(defaultRows as TableRelation[]);
      } catch (e) {
        setData([]);
        setOriginalData([]);
      }
      
      // Load initial neighborhood filter if it exists
      try {
        const neighborhoodStored = localStorage.getItem(`initial_neighborhood::${decoded}`);
        if (neighborhoodStored) {
          const parsed = JSON.parse(neighborhoodStored);
          setInitialNeighborhood(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        setInitialNeighborhood([]);
      }
      
      setLoading(false);
    };
    load();
  }, [fileKey]);

  if (loading) {
    return (
      <Box sx={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <CircularProgress size={60} sx={{ mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#666' }}>Loading your data...</Typography>
      </Box>
    );
  }
  
  if (!fileKey) return <Box sx={{ p: 4 }}>No file selected. <Button onClick={() => navigate('/landingPage')}>Back</Button></Box>;

  return (
    <Box sx={{ width: '100vw', height: '100vh' }}>
      <Graph data={data} fileKey={decodeURIComponent(fileKey)} initialNeighborhood={initialNeighborhood} originalData={originalData} />
    </Box>
  );
}
