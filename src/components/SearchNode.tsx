import React, { useState, useMemo, useCallback } from 'react';
import { 
  Autocomplete, 
  TextField, 
  Box, 
  Chip,
  Paper,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useReactFlow } from 'reactflow';

interface SearchNodeProps {
  nodes: any[];
  hiddenNodes: Set<string>;
  onNodeSelect: (nodeId: string) => void;
}

interface NodeOption {
  id: string;
  label: string;
  type: string;
  isVisible: boolean;
}

const SearchNode: React.FC<SearchNodeProps> = ({ 
  nodes, 
  hiddenNodes, 
  onNodeSelect 
}) => {
  const [selectedNode, setSelectedNode] = useState<NodeOption | null>(null);
  const { fitView, getNode } = useReactFlow();

  // Create searchable options from visible nodes
  const nodeOptions = useMemo(() => {
    return nodes
      .filter(node => !hiddenNodes.has(node.id))
      .map(node => ({
        id: node.id,
        label: node.data?.label || node.id,
        type: node.data?.type || 'unknown',
        isVisible: true
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes, hiddenNodes]);

  const handleNodeSelect = useCallback((nodeOption: NodeOption | null) => {
    setSelectedNode(nodeOption);
    
    if (nodeOption) {
      // Call the external callback
      onNodeSelect(nodeOption.id);
      
      // Focus on the selected node with animation
      const targetNode = getNode(nodeOption.id);
      if (targetNode) {
        fitView({
          nodes: [targetNode],
          duration: 800,
          padding: 0.3,
          minZoom: 1,
          maxZoom: 2
        });
      }
    }
  }, [onNodeSelect, getNode, fitView]);

  return (
    <Box sx={{ 
      minWidth: 280,
      maxWidth: 350,
    }}>
      <Autocomplete
        size="small"
        options={nodeOptions}
        value={selectedNode}
        onChange={(_, newValue) => handleNodeSelect(newValue)}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        filterOptions={(options, { inputValue }) => {
          if (!inputValue) return options.slice(0, 10); // Limit initial results
          
          const filtered = options.filter(option =>
            option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
            option.id.toLowerCase().includes(inputValue.toLowerCase()) ||
            option.type.toLowerCase().includes(inputValue.toLowerCase())
          );
          
          return filtered.slice(0, 20); // Limit filtered results
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search nodes..."
            variant="outlined"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <SearchIcon 
                  sx={{ 
                    color: '#666', 
                    mr: 1,
                    fontSize: '1.2rem'
                  }} 
                />
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fff',
                borderRadius: 2,
                fontSize: '0.85rem',
                '&:hover': {
                  backgroundColor: '#f8f9fa',
                },
                '&.Mui-focused': {
                  backgroundColor: '#fff',
                }
              }
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box 
            component="li" 
            {...props}
            sx={{
              padding: '8px 12px !important',
              borderBottom: '1px solid #f0f0f0',
              '&:last-child': {
                borderBottom: 'none'
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  color: '#1976d2',
                  wordBreak: 'break-word'
                }}
              >
                {option.label}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#666',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace'
                  }}
                >
                  ID: {option.id}
                </Typography>
                {option.type && (
                  <Chip 
                    label={option.type}
                    size="small"
                    sx={{ 
                      fontSize: '0.7rem',
                      height: '18px',
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2'
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        )}
        PaperComponent={(props) => (
          <Paper 
            {...props} 
            sx={{ 
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid #e0e0e0',
              borderRadius: 2,
              maxHeight: '400px',
              '& .MuiAutocomplete-listbox': {
                padding: 0,
                maxHeight: '350px'
              }
            }} 
          />
        )}
        noOptionsText={
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              No matching nodes found
            </Typography>
          </Box>
        }
        clearOnBlur={false}
        clearOnEscape
        openOnFocus
      />
    </Box>
  );
};

export default SearchNode;