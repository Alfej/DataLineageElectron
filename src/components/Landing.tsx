import React from 'react';
import { Box, Button, Typography, List, ListItem, ListItemText, ListItemButton, CircularProgress } from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useNavigate } from 'react-router-dom';
import { parseCsvFile } from '../utils/parseCSV';
import { buildHierarchicalStructure } from '../utils/hierarchicalParser';
import { saveHierarchicalData, getStoredFiles, generateFileKey } from '../utils/hierarchicalStorage';
import { getStructureStats } from '../utils/hierarchicalParser';
import logo from '../assets/PepsiCoLogo.png';
import bg from '../assets/PepsiCoBG.png';

export default function Landing() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const [savedFiles, setSavedFiles] = React.useState<{ key: string; name: string; uploadedAt?: number }[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedName, setSelectedName] = React.useState<string>('');
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Load stored files using new hierarchical storage system
    const files = getStoredFiles();
    setSavedFiles(files.map(f => ({
      key: f.key,
      name: f.fileName,
      uploadedAt: new Date(f.uploadedAt).getTime()
    })));
  }, []);

  const handleUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      // Parse CSV file
      const parsed = (await parseCsvFile(file)) as Record<string, unknown>[];
      
      // Build hierarchical structure
      const structure = buildHierarchicalStructure(parsed);
      
      // Get statistics
      const stats = getStructureStats(structure);
      console.log('📊 Hierarchical structure stats:', stats);
      
      // Generate file key
      const fileKey = generateFileKey(file.name, file.size, file.lastModified);
      
      // Save to localStorage with new hierarchical structure
      const savedKey = saveHierarchicalData(
        file.name,
        file.size,
        file.lastModified,
        structure,
        parsed as any
      );
      
      if (savedKey) {
        const totalNodes = stats.reduce((sum, s) => sum + s.uniqueValues, 0);
        console.log(`✅ Saved hierarchical structure with ${totalNodes} unique nodes`);
        navigate(`/Graph/${encodeURIComponent(fileKey)}`);
      } else {
        alert('Failed to save data. File may be too large for localStorage.');
      }
    } catch (error) {
      console.error('Error processing CSV:', error);
      alert('Error processing CSV file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box sx={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#BCC5E1' }}>
      {/* header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, background: '#fff', boxShadow: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1565c0' }}>Lineage Visualization</Typography>
        <Box>
          <img src={logo} alt="logo" style={{ height: 56 }} />
        </Box>
      </Box>

      {/* main content with right-aligned BG image */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: ['50vw','45vw','40vw'], zIndex: 1 }}>
          <img src={bg} alt="bg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
        <Box sx={{ textAlign: 'center', p: 4, background: '#fff', borderRadius: 2, boxShadow: 3, width: 600, zIndex: 2 }}>
          <Typography variant="h5" sx={{ mb: 2, color: '#333' }}>Upload CSV to visualize graph</Typography>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) {
              setSelectedFile(f);
              setSelectedName(f.name);
            }
          }}
        />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', mb: 2 }}>
          <Button variant="contained" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>Choose CSV</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => { if (selectedFile) { handleUpload(selectedFile); } }} 
            disabled={!selectedFile || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isProcessing ? 'Processing...' : 'Generate Lineage'}
          </Button>
        </Box>
        {selectedName && <Typography variant="body2" sx={{ mb: 2, color: '#444' }}>Selected: {selectedName}</Typography>}

        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, color: '#333' }}>Previously uploaded files</Typography>
        <List>
          {savedFiles.length === 0 && <ListItem><ListItemText primary="No previous files" sx={{ '& .MuiListItemText-primary': { color: '#666' } }} /></ListItem>}
          {savedFiles.map((f) => (
            <ListItem key={f.key} disablePadding>
              <ListItemButton 
                onClick={() => navigate(`/Graph/${encodeURIComponent(f.key)}`)}
                sx={{ 
                  '&:hover': { backgroundColor: '#f5f5f5' },
                  borderRadius: 1
                }}
              >
                <InsertDriveFileOutlinedIcon fontSize="small" sx={{ mr: 1, color: '#1976d2' }} />
                <ListItemText 
                  primary={f.name} 
                  sx={{ '& .MuiListItemText-primary': { color: '#333' } }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  </Box>
  );
}
