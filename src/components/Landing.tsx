import React from 'react';
import { Box, Button, Typography, List, ListItem, ListItemText, ListItemButton, CircularProgress } from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useNavigate } from 'react-router-dom';
import { parseCsvFile } from '../utils/parseCSV';
import { filterDataWithLimit } from '../utils/filterData';
import { TableRelation } from './graph/graphModel';
import FilterModal from './FilterModal';
import logo from '../assets/PepsiCoLogo.png';
import bg from '../assets/PepsiCoBG.png';

export default function Landing() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const [savedFiles, setSavedFiles] = React.useState<{ key: string; name: string }[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedName, setSelectedName] = React.useState<string>('');
  const [parsedData, setParsedData] = React.useState<TableRelation[] | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    // Scan localStorage for keys that match graph_node_state::{fileKey} or current_Filters_state::{fileKey}
    const files: { key: string; name: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) as string;
      if (!k) continue;
      // Expect pattern: <base>::<fileKey> or base::fileKey
      const parts = k.split('::');
      if (parts.length >= 2) {
        const fileKey = parts.slice(1).join('::');
        // we only want unique fileKeys
        if (!files.find(f => f.key === fileKey)) {
          files.push({ key: fileKey, name: fileKey.split('::')[0] });
        }
      }
    }
    setSavedFiles(files);
  }, []);

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const parsed = (await parseCsvFile(file)) as TableRelation[];
      setParsedData(parsed);
      setModalOpen(true);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV file. Please check the file format.');
    } finally {
      setIsLoading(false);
    }
  };



  const handleFilterSubmit = (selectedLevels: string[], selectedTypes: string[], applyNeighborhood: boolean) => {
    if (!parsedData || !selectedFile) return;
    
    // Apply filtering with limit (including neighborhood if enabled)
    const filteredData = filterDataWithLimit(parsedData, {
      selectedLevels,
      selectedTypes,
      applyNeighborhood,
    });

    const key = `${selectedFile.name}::${selectedFile.size}::${selectedFile.lastModified}`;
    
    // Save filtered data to localStorage
    try {
      localStorage.setItem(`uploaded_csv::${key}`, JSON.stringify(filteredData));
      
      // If neighborhood is enabled, save the selected table names as initial neighborhood filter
      if (applyNeighborhood && selectedLevels.length > 0) {
        localStorage.setItem(`initial_neighborhood::${key}`, JSON.stringify(selectedLevels));
      } else {
        // Clear any previous neighborhood setting for this file
        localStorage.removeItem(`initial_neighborhood::${key}`);
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
    
    setModalOpen(false);
    navigate(`/Graph/${encodeURIComponent(key)}`);
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
          <Button variant="contained" onClick={() => fileInputRef.current?.click()} sx={{}}>Choose CSV</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => { if (selectedFile) { handleUpload(selectedFile); } }} 
            disabled={!selectedFile || isLoading}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isLoading ? 'Processing...' : 'Generate Lineage'}
          </Button>
        </Box>
        {selectedName && <Typography variant="body2" sx={{ mb: 2, color: '#444' }}>Selected: {selectedName}</Typography>}

        {/* Filter Modal */}
        {parsedData && (
          <FilterModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            data={parsedData}
            onSubmit={handleFilterSubmit}
          />
        )}

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
