import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';
import { parseCsvFile } from '../utils/parseCSV';
import { TableRelation } from '../components/graph/graphModel';
import { Box, Button, Typography } from '@mui/material';
import { HierarchyFromToConfig, transformRelationsFromTo, transformRelations } from '../utils/hierarchyTransform';
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
    from: 'Sector',
    to: 'Application',
    fromValues: [],  // Empty by default
    toValues: []     // Empty by default
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
          const transformed = transformRelations(rawRows, hierarchyConfig.from);
          setData(transformed);
        }
      } else {
        setData([]);
      }
      return;
    }

    // NEW LOGIC: Use hierarchical structure to build graph
    const hasFromValues = hierarchyConfig.fromValues && hierarchyConfig.fromValues.length > 0;
    const hasToValues = hierarchyConfig.toValues && hierarchyConfig.toValues.length > 0;

    if (!hasFromValues || !hasToValues) {
      // No selections = empty graph
      console.log('ℹ️ No FROM/TO values selected - empty graph');
      setData([]);
      return;
    }

    console.log('🔨 Building graph with selections:', {
      from: `${hierarchyConfig.from}: [${hierarchyConfig.fromValues.join(', ')}]`,
      to: `${hierarchyConfig.to}: [${hierarchyConfig.toValues.join(', ')}]`
    });

    // Import graph builder functions
    import('../utils/graphBuilder').then(async ({ buildGraphRelationshipsV4, convertToTableRelations }) => {
      // Build relationships using updated V4 logic
      const relationships = await buildGraphRelationshipsV4(
        hierarchicalStructure,
        hierarchyConfig.from,
        hierarchyConfig.fromValues,
        hierarchyConfig.to,
        hierarchyConfig.toValues
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
  const hasSelections = hierarchyConfig.fromValues && hierarchyConfig.fromValues.length > 0 
    && hierarchyConfig.toValues && hierarchyConfig.toValues.length > 0;
  
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
