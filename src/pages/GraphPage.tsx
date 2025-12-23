import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';
import { parseCsvFile } from '../utils/parseCSV';
import { TableRelation } from '../components/graph/graphModel';
import { Box, Button, Typography } from '@mui/material';
import { HierarchyFromToConfig, transformRelationsFromTo } from '../utils/hierarchyTransform';
import { loadHierarchicalData } from '../utils/hierarchicalStorage';
import { HierarchicalDataStructure } from '../types/nodeModel';

export default function GraphPage() {
  const { fileKey } = useParams<{ fileKey: string }>();
  const navigate = useNavigate();
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [data, setData] = useState<TableRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hierarchicalStructure, setHierarchicalStructure] = useState<HierarchicalDataStructure | null>(null);
  
  // Hierarchy configuration state - NO default selections
  const [hierarchyConfig, setHierarchyConfig] = useState<HierarchyFromToConfig>({
    selectedLevels: [],  // Empty by default
    selectedValues: []   // Empty by default
  });



  useEffect(() => {
    const load = async () => {
      if (!fileKey) return;
      const decoded = decodeURIComponent(fileKey);
      
      // First, try to load hierarchical structure (new v3.0 format)
      const hierarchicalData = loadHierarchicalData(decoded);
      if (hierarchicalData) {
        console.log('✅ Loaded hierarchical structure (v3.0)');
        setHierarchicalStructure(hierarchicalData.structure);
        setRawRows(hierarchicalData.rawCSV as any);
        setLoading(false);
        return;
      }
      
      // Fallback: try old uploaded_csv format
      const csvStored = localStorage.getItem(`uploaded_csv::${decoded}`);
      if (csvStored) {
        try {
          const parsed = JSON.parse(csvStored);
          setRawRows(parsed as Record<string, unknown>[]);
          const transformed = transformRelationsFromTo(parsed as Record<string, unknown>[], hierarchyConfig);
          setData(transformed);
          setLoading(false);
          return;
        } catch (error) {
          console.error('Error parsing CSV from localStorage:', error);
          // fallthrough
        }
      }

      // Try to find any uploaded_csv key
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) as string;
        if (!k) continue;
        if (k.includes(decoded) && k.startsWith('uploaded_csv::')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) as string);
            setRawRows(parsed as Record<string, unknown>[]);
            setData(transformRelationsFromTo(parsed as Record<string, unknown>[], hierarchyConfig));
            setLoading(false);
            return;
          } catch {
            // continue
          }
        }
      }

      // As a last resort, try to load the default bundled CSV
      try {
        const defaultRows = await parseCsvFile('data/final_output.csv');
        setRawRows(defaultRows as Record<string, unknown>[]);
        const transformed = transformRelationsFromTo(defaultRows as Record<string, unknown>[], hierarchyConfig);
        setData(transformed);
      } catch (error) {
        console.error('Error loading default CSV:', error);
        setRawRows([]);
        setData([]);
      }
      setLoading(false);
    };
    load();
  }, [fileKey]);

  // Build graph ONLY when hierarchy config changes (i.e., when Apply is clicked)
  useEffect(() => {
    // If no hierarchical structure, fall back to old CSV-based approach
    if (!hierarchicalStructure) {
      if (rawRows && rawRows.length > 0) {
        try {
          const transformed = transformRelationsFromTo(rawRows, hierarchyConfig);
          setData(transformed);
        } catch (error) {
          console.error('Error in transformRelationsFromTo:', error);
          setData([]);
        }
      } else {
        setData([]);
      }
      return;
    }

    // NEW LOGIC: Use hierarchical structure to build graph
    const hasLevels = hierarchyConfig.selectedLevels && hierarchyConfig.selectedLevels.length > 0;
    const hasValues = hierarchyConfig.selectedValues && hierarchyConfig.selectedValues.length > 0;

    if (!hasLevels || !hasValues) {
      // No selections = empty graph
      console.log('ℹ️ No levels/values selected - empty graph');
      setData([]);
      return;
    }

    console.log('🔨 Building graph with selections:', {
      levels: hierarchyConfig.selectedLevels.join(', '),
      values: `${hierarchyConfig.selectedValues.length} value(s)`
    });

    // Import graph builder functions
    import('../utils/graphBuilder').then(async ({ buildGraphRelationshipsV5, convertToTableRelations }) => {
      // Build relationships using updated V5 logic for multi-level selection
      const relationships = await buildGraphRelationshipsV5(
        hierarchicalStructure,
        hierarchyConfig.selectedLevels,
        hierarchyConfig.selectedValues
      );

      console.log(`✅ Built ${relationships.length} relationship pairs`);

      // Convert to TableRelation format for Graph component
      const tableRelations = convertToTableRelations(relationships);
      
      console.log(`📊 Converted to ${tableRelations.length} table relations`);
      
      setData(tableRelations);
    });
  }, [hierarchyConfig, hierarchicalStructure, rawRows]);

  if (loading) return (
    <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Typography variant="h6">Loading...</Typography>
    </Box>
  );
  
  if (!fileKey) return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>No file selected</Typography>
      <Button onClick={() => navigate('/landingPage')}>Back to Landing Page</Button>
    </Box>
  );
  


  const decodedKey = decodeURIComponent(fileKey);
  
  // Check if we should show empty state
  const hasSelections = hierarchyConfig.selectedLevels && hierarchyConfig.selectedLevels.length > 0 
    && hierarchyConfig.selectedValues && hierarchyConfig.selectedValues.length > 0;
  
  const showEmptyState = !hasSelections || (hasSelections && data.length === 0);
  
  return (
    <Box sx={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Graph 
          data={data} 
          fileKey={decodedKey} 
          rawData={rawRows}
          hierarchyConfig={hierarchyConfig} 
          onHierarchyConfigChange={setHierarchyConfig}
          hierarchicalStructure={hierarchicalStructure}
          showEmptyState={showEmptyState}
        />
      </Box>
    </Box>
  );
}
