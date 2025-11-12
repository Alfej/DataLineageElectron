import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Chip,
  Button,
  Modal,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { HierarchyLevel } from '../utils/hierarchyTransform';

const HIERARCHY_OPTIONS: HierarchyLevel[] = [
  'Sector',
  'Application', 
  'Purpose',
  'Client',
  'Tool',
  'System',
  'Schema',
  'ObjectName'
];

export interface HierarchyFromToConfig {
  from: HierarchyLevel;
  to: HierarchyLevel;
  fromValues: string[];
  toValues: string[];
}

interface HierarchyFromToSelectorProps {
  data: Record<string, unknown>[];
  value: HierarchyFromToConfig;
  onChange: (config: HierarchyFromToConfig) => void;
}

const HierarchyFromToSelector: React.FC<HierarchyFromToSelectorProps> = ({
  data,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [tempFromValues, setTempFromValues] = useState<string[]>([]);
  const [tempToValues, setTempToValues] = useState<string[]>([]);
  const [tempFromLevel, setTempFromLevel] = useState<HierarchyLevel>(value.from);
  const [tempToLevel, setTempToLevel] = useState<HierarchyLevel>(value.to);
  const [fromSearchQuery, setFromSearchQuery] = useState<string>('');
  const [toSearchQuery, setToSearchQuery] = useState<string>('');

  // Helper function to check if a TO option should be disabled
  const isToLevelDisabled = (option: HierarchyLevel): boolean => {
    const fromIndex = HIERARCHY_OPTIONS.indexOf(tempFromLevel);
    const optionIndex = HIERARCHY_OPTIONS.indexOf(option);
    // Disable if option is at same level or before (higher in hierarchy) than FROM level
    return optionIndex <= fromIndex;
  };

  // Field mapping for parent and child columns
  const getParentField = (level: HierarchyLevel): string => {
    const fieldMap: Record<HierarchyLevel, string> = {
      Sector: "ParentSector",
      Application: "ParentApplication", 
      Purpose: "ParentPurpose",
      Client: "ParentClient",
      Tool: "ParentTool",
      System: "ParentSystemID",
      Schema: "ParentSchema",
      ObjectName: "ParentObjectName",
    };
    return fieldMap[level];
  };

  const getChildField = (level: HierarchyLevel): string => {
    const fieldMap: Record<HierarchyLevel, string> = {
      Sector: "ChildSector",
      Application: "ChildApplication",
      Purpose: "ChildPurpose", 
      Client: "ChildClient",
      Tool: "ChildTool",
      System: "ChildSystemID",
      Schema: "ChildSchema",
      ObjectName: "ChildObjectName",
    };
    return fieldMap[level];
  };

  // Get unique values for the selected hierarchy level (both parent and child columns)
  const getUniqueValues = useMemo(() => (level: HierarchyLevel): string[] => {
    if (!data || data.length === 0) return [];
    
    const parentField = getParentField(level);
    const childField = getChildField(level);
    
    const values = new Set<string>();
    
    data.forEach(row => {
      if (!row) return;
      
      const parentValue = row[parentField];
      const childValue = row[childField];
      
      if (parentValue && typeof parentValue === 'string' && parentValue.trim()) {
        values.add(parentValue.trim());
      }
      if (childValue && typeof childValue === 'string' && childValue.trim()) {
        values.add(childValue.trim());
      }
    });
    
    return Array.from(values).sort();
  }, [data]);

  // Memoize the unique values to avoid recalculating on every render
  const fromOptions = useMemo(() => getUniqueValues(tempFromLevel), [getUniqueValues, tempFromLevel]);
  const toOptions = useMemo(() => getUniqueValues(tempToLevel), [getUniqueValues, tempToLevel]);

  // Filtered options based on search query
  const filteredFromOptions = useMemo(() => {
    if (!fromSearchQuery.trim()) return fromOptions;
    return fromOptions.filter(option => 
      option.toLowerCase().includes(fromSearchQuery.toLowerCase())
    );
  }, [fromOptions, fromSearchQuery]);

  const filteredToOptions = useMemo(() => {
    if (!toSearchQuery.trim()) return toOptions;
    return toOptions.filter(option => 
      option.toLowerCase().includes(toSearchQuery.toLowerCase())
    );
  }, [toOptions, toSearchQuery]);

  // Track previous values to detect changes and reset temp state
  const prevFromRef = useRef(tempFromLevel);
  const prevToRef = useRef(tempToLevel);

  useEffect(() => {
    if (prevFromRef.current !== tempFromLevel) {
      prevFromRef.current = tempFromLevel;
      setTempFromValues([]);
      setFromSearchQuery(''); // Reset search when level changes
    }
  }, [tempFromLevel]);

  useEffect(() => {
    if (prevToRef.current !== tempToLevel) {
      prevToRef.current = tempToLevel;
      setTempToValues([]);
      setToSearchQuery(''); // Reset search when level changes
    }
  }, [tempToLevel]);

  // Update temp values when prop values change
  useEffect(() => {
    setTempFromValues(value.fromValues);
  }, [value.fromValues]);

  useEffect(() => {
    setTempToValues(value.toValues);
  }, [value.toValues]);

  // Update temp levels when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempFromLevel(value.from);
      setTempToLevel(value.to);
      setTempFromValues(value.fromValues);
      setTempToValues(value.toValues);
    }
  }, [isOpen, value]);

  const handleFromLevelChange = (newLevel: HierarchyLevel) => {
    setTempFromLevel(newLevel);
    setTempFromValues([]); // Reset temp values when level changes
  };

  const handleToLevelChange = (newLevel: HierarchyLevel) => {
    setTempToLevel(newLevel);
    setTempToValues([]); // Reset temp values when level changes
  };

  const SELECT_ALL_VALUE = '__SELECT_ALL__';

  const handleFromValuesChange = (selectedValues: string[]) => {
    // Check if "Select All" was clicked
    if (selectedValues.includes(SELECT_ALL_VALUE)) {
      // If all are currently selected, deselect all
      if (tempFromValues.length === fromOptions.length) {
        setTempFromValues([]);
      } else {
        // Select all options
        setTempFromValues([...fromOptions]);
      }
    } else {
      setTempFromValues(selectedValues);
    }
  };

  const handleToValuesChange = (selectedValues: string[]) => {
    // Check if "Select All" was clicked
    if (selectedValues.includes(SELECT_ALL_VALUE)) {
      // If all are currently selected, deselect all
      if (tempToValues.length === toOptions.length) {
        setTempToValues([]);
      } else {
        // Select all options
        setTempToValues([...toOptions]);
      }
    } else {
      setTempToValues(selectedValues);
    }
  };

  const handleApply = () => {
    onChange({
      from: tempFromLevel,
      to: tempToLevel,
      fromValues: tempFromValues,
      toValues: tempToValues,
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    // Clear and immediately apply to reset the filter
    onChange({
      from: tempFromLevel,
      to: tempToLevel,
      fromValues: [],
      toValues: [],
    });
    setTempFromValues([]);
    setTempToValues([]);
    setIsOpen(false); // Close modal after clearing
  };

  const isActive = (value.fromValues?.length > 0 || value.toValues?.length > 0);

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="contained"
        startIcon={<FilterAltOutlinedIcon />}
        onClick={() => setIsOpen(true)}
        sx={{
          backgroundColor: isActive ? '#1976d2' : '#f5f5f5',
          color: isActive ? '#fff' : '#666',
          fontWeight: 600,
          fontSize: '0.875rem',
          px: 2,
          py: 1,
          width: "100%",
          borderRadius: 2,
          textTransform: 'none',
          boxShadow: isActive ? '0 2px 8px rgba(25, 118, 210, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
          '&:hover': {
            backgroundColor: isActive ? '#1565c0' : '#e0e0e0',
          },
        }}
      >
        Hierarchy Filter
        {isActive && (
          <Chip 
            label={`${value.from} → ${value.to}`}
            size="small"
            sx={{ 
              ml: 1,
              height: '20px',
              fontSize: '0.65rem',
              backgroundColor: 'rgba(255,255,255,0.3)',
              color: '#fff',
              fontWeight: 600
            }}
          />
        )}
      </Button>

      {/* Modal */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ 
          position: 'relative',
          width: '90%',
          maxWidth: 700,
          bgcolor: 'background.paper',
          borderRadius: 3,
          boxShadow: 24,
          p: 0,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Modal Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 3,
            pb: 2,
            borderBottom: '1px solid #e0e0e0',
          }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2' }}>
                Hierarchy Filter
              </Typography>
              <Typography variant="caption" sx={{ color: '#666', mt: 0.5, display: 'block' }}>
                Filter the graph by hierarchy levels and values
              </Typography>
            </Box>
            <IconButton
              onClick={() => setIsOpen(false)}
              sx={{
                color: '#666',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Modal Content */}
          <Box sx={{ 
            p: 3,
            flex: 1,
            overflowY: 'auto',
          }}>
      {/* From and To Sections - Horizontal Layout */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* From Section */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2, 
          flex: 1,
          minWidth: 0,
          p: 2,
          borderRadius: 2,
          backgroundColor: '#f8f9ff',
          border: '2px solid #e3f2fd',
        }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            From
          </Typography>
          
          {/* From Hierarchy Level */}
          <FormControl fullWidth>
            <InputLabel>Level</InputLabel>
            <Select
              value={tempFromLevel}
              onChange={(e) => handleFromLevelChange(e.target.value as HierarchyLevel)}
              label="Level"
            >
              {HIERARCHY_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* From Values Multi-Select */}
          {fromOptions.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Values</InputLabel>
              <Select
                multiple
                value={tempFromValues}
                onChange={(e) => handleFromValuesChange(e.target.value as string[])}
                input={<OutlinedInput label="Values" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.length === 0 ? (
                      <Typography sx={{ color: '#999' }}>Select values...</Typography>
                    ) : selected.length <= 2 ? (
                      selected.map((value) => (
                        <Chip 
                          key={value} 
                          label={value} 
                          size="small" 
                          sx={{ 
                            fontSize: '0.75rem', 
                            height: '24px',
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2'
                          }}
                        />
                      ))
                    ) : (
                      <Chip 
                        label={`${selected.length} selected`}
                        size="small" 
                        sx={{ 
                          fontSize: '0.75rem', 
                          height: '24px',
                          backgroundColor: '#1976d2',
                          color: '#fff'
                        }}
                      />
                    )}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 400,
                    },
                  },
                  autoFocus: false,
                }}
              >
                {/* Search Box */}
                <Box sx={{ px: 2, py: 1.5, position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1, borderBottom: '1px solid #e0e0e0' }}>
                  <TextField
                    size="small"
                    placeholder="Search values..."
                    fullWidth
                    value={fromSearchQuery}
                    onChange={(e) => setFromSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" sx={{ color: '#999' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#f5f5f5',
                      }
                    }}
                  />
                </Box>

                {/* Select All Option */}
                <MenuItem
                  value={SELECT_ALL_VALUE}
                  sx={{
                    backgroundColor: '#f5f5f5',
                    fontWeight: 600,
                    borderBottom: '2px solid #e0e0e0',
                    '&:hover': {
                      backgroundColor: '#e3f2fd',
                    }
                  }}
                >
                  <Checkbox 
                    checked={tempFromValues.length === fromOptions.length && fromOptions.length > 0}
                    indeterminate={tempFromValues.length > 0 && tempFromValues.length < fromOptions.length}
                  />
                  <ListItemText 
                    primary="Select All" 
                    primaryTypographyProps={{ 
                      fontWeight: 600,
                      color: '#1976d2'
                    }}
                  />
                </MenuItem>
                
                {filteredFromOptions.length === 0 ? (
                  <MenuItem disabled>
                    <ListItemText 
                      primary="No results found" 
                      primaryTypographyProps={{ 
                        fontStyle: 'italic',
                        color: '#999'
                      }}
                    />
                  </MenuItem>
                ) : (
                  filteredFromOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      <Checkbox 
                        checked={tempFromValues.indexOf(option) > -1}
                      />
                      <ListItemText primary={option} />
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Arrow Connector */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          px: 1,
          pt: 6
        }}>
          <Typography variant="h4" sx={{ color: '#90caf9', fontWeight: 'bold' }}>
            →
          </Typography>
        </Box>

        {/* To Section */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2, 
          flex: 1,
          minWidth: 0,
          p: 2,
          borderRadius: 2,
          backgroundColor: '#f1f8f4',
          border: '2px solid #e8f5e9',
        }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            To
          </Typography>
          
          {/* To Hierarchy Level */}
          <FormControl fullWidth>
            <InputLabel>Level</InputLabel>
            <Select
              value={tempToLevel}
              onChange={(e) => handleToLevelChange(e.target.value as HierarchyLevel)}
              label="Level"
            >
              {HIERARCHY_OPTIONS.map((option) => (
                <MenuItem 
                  key={option} 
                  value={option}
                  disabled={isToLevelDisabled(option)}
                  sx={{
                    '&.Mui-disabled': {
                      opacity: 0.5,
                      textDecoration: 'line-through',
                    }
                  }}
                >
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* To Values Multi-Select */}
          {toOptions.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Values</InputLabel>
              <Select
                multiple
                value={tempToValues}
                onChange={(e) => handleToValuesChange(e.target.value as string[])}
                input={<OutlinedInput label="Values" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.length === 0 ? (
                      <Typography sx={{ color: '#999' }}>Select values...</Typography>
                    ) : selected.length <= 2 ? (
                      selected.map((value) => (
                        <Chip 
                          key={value} 
                          label={value} 
                          size="small" 
                          sx={{ 
                            fontSize: '0.75rem', 
                            height: '24px',
                            backgroundColor: '#e8f5e9',
                            color: '#2e7d32'
                          }}
                        />
                      ))
                    ) : (
                      <Chip 
                        label={`${selected.length} selected`}
                        size="small" 
                        sx={{ 
                          fontSize: '0.75rem', 
                          height: '24px',
                          backgroundColor: '#2e7d32',
                          color: '#fff'
                        }}
                      />
                    )}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 400,
                    },
                  },
                  autoFocus: false,
                }}
              >
                {/* Search Box */}
                <Box sx={{ px: 2, py: 1.5, position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1, borderBottom: '1px solid #e0e0e0' }}>
                  <TextField
                    size="small"
                    placeholder="Search values..."
                    fullWidth
                    value={toSearchQuery}
                    onChange={(e) => setToSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" sx={{ color: '#999' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#f5f5f5',
                      }
                    }}
                  />
                </Box>

                {/* Select All Option */}
                <MenuItem
                  value={SELECT_ALL_VALUE}
                  sx={{
                    backgroundColor: '#f5f5f5',
                    fontWeight: 600,
                    borderBottom: '2px solid #e0e0e0',
                    '&:hover': {
                      backgroundColor: '#e8f5e9',
                    }
                  }}
                >
                  <Checkbox 
                    checked={tempToValues.length === toOptions.length && toOptions.length > 0}
                    indeterminate={tempToValues.length > 0 && tempToValues.length < toOptions.length}
                  />
                  <ListItemText 
                    primary="Select All" 
                    primaryTypographyProps={{ 
                      fontWeight: 600,
                      color: '#2e7d32'
                    }}
                  />
                </MenuItem>
                
                {filteredToOptions.length === 0 ? (
                  <MenuItem disabled>
                    <ListItemText 
                      primary="No results found" 
                      primaryTypographyProps={{ 
                        fontStyle: 'italic',
                        color: '#999'
                      }}
                    />
                  </MenuItem>
                ) : (
                  filteredToOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      <Checkbox 
                        checked={tempToValues.indexOf(option) > -1}
                      />
                      <ListItemText primary={option} />
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>
          </Box>

          {/* Modal Footer */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 3,
            pt: 2,
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#fafafa',
          }}>
            <Button
              variant="text"
              onClick={handleClear}
              sx={{
                px: 3,
                py: 1,
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#d32f2f',
                '&:hover': {
                  backgroundColor: 'rgba(211, 47, 47, 0.08)',
                }
              }}
            >
              Clear
            </Button>
            
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                onClick={() => setIsOpen(false)}
                sx={{
                  px: 3,
                  py: 1,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  borderColor: '#ccc',
                  color: '#666',
                  '&:hover': {
                    borderColor: '#999',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                  }
                }}
              >
                Cancel
              </Button>
              
              <Button
                variant="contained"
                onClick={handleApply}
                sx={{
                  px: 4,
                  py: 1,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  backgroundColor: '#1976d2',
                  boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
                  '&:hover': {
                    backgroundColor: '#1565c0',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
                  },
                  '&:disabled': {
                    backgroundColor: '#e0e0e0',
                    color: '#999',
                    boxShadow: 'none',
                  }
                }}
                disabled={
                  (fromOptions.length > 0 && tempFromValues.length === 0) || 
                  (toOptions.length > 0 && tempToValues.length === 0)
                }
              >
                Apply Filter
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
    </>
  );
};

export default HierarchyFromToSelector;