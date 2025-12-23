import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Checkbox,
  ListItemText,
  Button,
} from '@mui/material';
import { HierarchyLevel, HierarchyFromToConfig } from '../utils/hierarchyTransform';

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

interface HierarchyLevelSelectorProps {
  data: Record<string, unknown>[];
  value: HierarchyFromToConfig;
  onChange: (config: HierarchyFromToConfig) => void;
}

const HierarchyLevelSelector: React.FC<HierarchyLevelSelectorProps> = ({
  data,
  value,
  onChange,
}) => {
  const [selectedLevels, setSelectedLevels] = useState<HierarchyLevel[]>([]);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);

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

  // Track selected values internally (not displayed in UI, but used for onChange callback)
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  // Initialize from prop value
  useEffect(() => {
    setSelectedLevels(value.selectedLevels || []);
    setSelectedValues(value.selectedValues || []);
  }, [value.selectedLevels, value.selectedValues]);

  const handleLevelsChange = (newLevels: HierarchyLevel[]) => {
    setSelectedLevels(newLevels);
    
    // Auto-select all values for the selected levels
    if (newLevels.length > 0) {
      const allValues = new Set<string>();
      
      newLevels.forEach(level => {
        const parentField = getParentField(level);
        const childField = getChildField(level);
        
        data.forEach(row => {
          if (!row) return;
          
          const parentValue = row[parentField];
          const childValue = row[childField];
          
          if (parentValue && typeof parentValue === 'string' && parentValue.trim()) {
            allValues.add(parentValue.trim());
          }
          if (childValue && typeof childValue === 'string' && childValue.trim()) {
            allValues.add(childValue.trim());
          }
        });
      });
      
      const valuesArray = Array.from(allValues).sort();
      setSelectedValues(valuesArray);
      
      // Delay the graph update to let UI settle
      setTimeout(() => {
        onChange({
          selectedLevels: newLevels,
          selectedValues: valuesArray,
        });
      }, 500); // 500ms delay
    } else {
      // No levels selected, clear everything
      setSelectedValues([]);
      onChange({
        selectedLevels: [],
        selectedValues: [],
      });
    }
  };

  // Auto-select Sector on first load
  useEffect(() => {
    if (!hasInitialized && data && data.length > 0) {
      setHasInitialized(true);
      
      // If no levels are currently selected, auto-select Sector
      if (!value.selectedLevels || value.selectedLevels.length === 0) {
        const defaultLevel: HierarchyLevel = 'Sector';
        handleLevelsChange([defaultLevel]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hasInitialized, value.selectedLevels]);

  const handleClearAll = () => {
    setSelectedLevels([]);
    setSelectedValues([]);
    onChange({
      selectedLevels: [],
      selectedValues: [],
    });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
      {/* Hierarchy Levels Dropdown */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <Typography variant="caption" sx={{ 
          fontWeight: 600, 
          color: '#323130', 
          fontSize: '0.75rem',
          mb: 0.5,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Hierarchy Levels
        </Typography>
        <Select
          multiple
          value={selectedLevels}
          onChange={(e) => handleLevelsChange(e.target.value as HierarchyLevel[])}
          displayEmpty
          renderValue={(selected) => {
            if (selected.length === 0) {
              return <Typography sx={{ color: '#a19f9d', fontSize: '0.875rem' }}>Select levels</Typography>;
            }
            return (
              <Typography sx={{ fontSize: '0.875rem', color: '#323130' }}>
                {selected.length} level{selected.length > 1 ? 's' : ''} selected
              </Typography>
            );
          }}
          sx={{
            bgcolor: '#fff',
            borderRadius: '4px',
            fontSize: '0.875rem',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#8a8886',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#323130',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#0078d4',
              borderWidth: '2px',
            },
          }}
        >
          {HIERARCHY_OPTIONS.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: '0.875rem', py: 1 }}>
              <Checkbox 
                checked={selectedLevels.indexOf(option) > -1}
                size="small"
                sx={{ 
                  color: '#8a8886',
                  '&.Mui-checked': { color: '#0078d4' },
                  mr: 1,
                }}
              />
              <ListItemText 
                primary={option} 
                primaryTypographyProps={{ 
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#323130',
                }} 
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Clear All Button */}
      {selectedLevels.length > 0 && (
        <Button
          variant="text"
          onClick={handleClearAll}
          sx={{
            color: '#605e5c',
            fontSize: '0.875rem',
            fontWeight: 600,
            textTransform: 'none',
            alignSelf: 'flex-end',
            minWidth: 'auto',
            px: 2,
            '&:hover': {
              bgcolor: '#f3f2f1',
            }
          }}
        >
          Clear All
        </Button>
      )}
    </Box>
  );
};

export default HierarchyLevelSelector;
