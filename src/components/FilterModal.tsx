import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Autocomplete,
  TextField,
  Chip,
  Alert,
  Popper,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { TableRelation } from './graph/graphModel';

const ITEMS_PER_PAGE = 10;

// Custom popper component to help with performance
const PopperComponent = function (props: React.ComponentProps<typeof Popper>) {
  return <Popper {...props} style={{ width: 'auto' }} placement="bottom-start" />;
};

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  data: TableRelation[];
  onSubmit: (selectedLevels: string[], selectedTypes: string[], applyNeighborhood: boolean) => void;
}

export default function FilterModal({ open, onClose, data, onSubmit }: FilterModalProps) {
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [applyNeighborhood, setApplyNeighborhood] = useState<boolean>(true);
  const [displayedLevelsCount, setDisplayedLevelsCount] = useState(ITEMS_PER_PAGE);
  const [displayedTypesCount, setDisplayedTypesCount] = useState(ITEMS_PER_PAGE);
  const levelsListboxRef = useRef<HTMLUListElement | null>(null);
  const typesListboxRef = useRef<HTMLUListElement | null>(null);
  const lastScrollTopLevels = useRef<number>(0);
  const lastScrollTopTypes = useRef<number>(0);

  // Extract unique values for levels (table names) and types from the data
  const { availableLevels, availableTypes } = useMemo(() => {
    const levelsSet = new Set<string>();
    const typesSet = new Set<string>();

    data.forEach((row) => {
      // Collect all table names (both parent and child)
      if (row.parentTableName) levelsSet.add(String(row.parentTableName));
      if (row.childTableName) levelsSet.add(String(row.childTableName));
      
      // Collect types
      if (row.parentTableType) typesSet.add(String(row.parentTableType));
      if (row.childTableType) typesSet.add(String(row.childTableType));
    });

    return {
      availableLevels: Array.from(levelsSet).sort((a, b) => a.localeCompare(b)),
      availableTypes: Array.from(typesSet).sort(),
    };
  }, [data]);

  // Custom filter function that limits results for performance
  const createLimitedFilterOptions = useCallback((limit: number) => {
    return (options: string[], state: any) => {
      const inputValue = state.inputValue.toLowerCase();
      if (!inputValue) {
        return options.slice(0, limit);
      }
      // Filter all options but limit results
      const filtered = options.filter(option => 
        option.toLowerCase().includes(inputValue)
      );
      return filtered.slice(0, limit);
    };
  }, []);

  const levelsFilterOptions = useMemo(
    () => createLimitedFilterOptions(displayedLevelsCount),
    [displayedLevelsCount, createLimitedFilterOptions]
  );

  const typesFilterOptions = useMemo(
    () => createLimitedFilterOptions(displayedTypesCount),
    [displayedTypesCount, createLimitedFilterOptions]
  );

  // Scroll handler for lazy loading
  const handleLevelsScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    lastScrollTopLevels.current = listboxNode.scrollTop;
    const position = listboxNode.scrollTop + listboxNode.clientHeight;
    const bottom = listboxNode.scrollHeight;
    
    if (position >= bottom - 100 && displayedLevelsCount < availableLevels.length) {
      setDisplayedLevelsCount(prev => {
        const newCount = Math.min(prev + ITEMS_PER_PAGE, availableLevels.length);
        console.log('Loading more levels:', newCount);
        // Restore scroll position after state update
        requestAnimationFrame(() => {
          if (levelsListboxRef.current) {
            levelsListboxRef.current.scrollTop = lastScrollTopLevels.current;
          }
        });
        return newCount;
      });
    }
  }, [displayedLevelsCount, availableLevels.length]);

  const handleTypesScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    lastScrollTopTypes.current = listboxNode.scrollTop;
    const position = listboxNode.scrollTop + listboxNode.clientHeight;
    const bottom = listboxNode.scrollHeight;
    
    if (position >= bottom - 100 && displayedTypesCount < availableTypes.length) {
      setDisplayedTypesCount(prev => {
        const newCount = Math.min(prev + ITEMS_PER_PAGE, availableTypes.length);
        console.log('Loading more types:', newCount);
        // Restore scroll position after state update
        requestAnimationFrame(() => {
          if (typesListboxRef.current) {
            typesListboxRef.current.scrollTop = lastScrollTopTypes.current;
          }
        });
        return newCount;
      });
    }
  }, [displayedTypesCount, availableTypes.length]);

  const handleSubmit = () => {
    if (selectedLevels.length === 0 && selectedTypes.length === 0) {
      return; // Don't submit if nothing selected
    }
    onSubmit(selectedLevels, selectedTypes, applyNeighborhood);
  };

  // Helper function to calculate complete lineage for estimation (matching Graph.tsx logic)
  const getCompleteLineage = useCallback((nodeId: string): { parents: string[], children: string[] } => {
    const allParents = new Set<string>();
    const allChildren = new Set<string>();
    const visited = new Set<string>();
    
    // Helper to get immediate parents and children from data
    const getImmediateRelations = (id: string): { parents: string[], children: string[] } => {
      const parents = data.filter((d) => d.childTableName === id).map((d) => d.parentTableName).filter(Boolean);
      const children = data.filter((d) => d.parentTableName === id).map((d) => d.childTableName).filter(Boolean);
      return { parents, children };
    };
    
    // Recursive function to traverse all ancestors
    const traverseAncestors = (id: string) => {
      if (visited.has(id)) return; // Prevent infinite loops
      visited.add(id);
      
      const { parents } = getImmediateRelations(id);
      
      for (const parentId of parents) {
        allParents.add(parentId);
        traverseAncestors(parentId); // Recursively get ancestors of this parent
      }
    };
    
    // Recursive function to traverse all descendants
    const traverseDescendants = (id: string) => {
      if (visited.has(id)) return; // Prevent infinite loops
      visited.add(id);
      
      const { children } = getImmediateRelations(id);
      
      for (const childId of children) {
        allChildren.add(childId);
        traverseDescendants(childId); // Recursively get descendants of this child
      }
    };
    
    // Reset visited set for each traversal type
    visited.clear();
    traverseAncestors(nodeId);
    
    visited.clear();
    traverseDescendants(nodeId);
    
    return {
      parents: Array.from(allParents),
      children: Array.from(allChildren)
    };
  }, [data]);

  const estimatedCount = useMemo(() => {
    if (selectedLevels.length === 0 && selectedTypes.length === 0) {
      const nodesSet = new Set<string>();
      data.forEach((row) => {
        nodesSet.add(row.parentTableName);
        nodesSet.add(row.childTableName);
      });
      return { edges: data.length, nodes: nodesSet.size };
    }

    // Calculate allowed nodes if neighborhood filter is enabled
    let allowedNodes: Set<string> | null = null;
    if (applyNeighborhood && selectedLevels.length > 0) {
      const completeNeighborhood = new Set<string>();
      
      selectedLevels.forEach(nodeId => {
        completeNeighborhood.add(nodeId);
        
        const { parents, children } = getCompleteLineage(nodeId);
        
        parents.forEach(a => completeNeighborhood.add(a));
        children.forEach(d => completeNeighborhood.add(d));
      });
      
      allowedNodes = completeNeighborhood;
    }

    const filtered = data.filter((row) => {
      // If neighborhood filter is active, ONLY check if both parent and child are in allowed nodes
      // Skip the levelMatch filter because allowedNodes already contains the complete lineage
      if (allowedNodes) {
        const inNeighborhood = allowedNodes.has(row.parentTableName) && allowedNodes.has(row.childTableName);
        // Still apply type filter if specified
        const typeMatch = selectedTypes.length === 0 ||
          selectedTypes.includes(String(row.parentTableType)) ||
          selectedTypes.includes(String(row.childTableType));
        return inNeighborhood && typeMatch;
      }
      
      // When neighborhood is NOT active, apply normal filters
      const levelMatch = selectedLevels.length === 0 || 
        selectedLevels.includes(String(row.parentTableName)) || 
        selectedLevels.includes(String(row.childTableName));
      
      const typeMatch = selectedTypes.length === 0 ||
        selectedTypes.includes(String(row.parentTableType)) ||
        selectedTypes.includes(String(row.childTableType));

      return levelMatch && typeMatch;
    });

    // Count unique nodes
    const nodesSet = new Set<string>();
    filtered.forEach((row) => {
      nodesSet.add(row.parentTableName);
      nodesSet.add(row.childTableName);
    });

    return { edges: filtered.length, nodes: nodesSet.size };
  }, [data, selectedLevels, selectedTypes, applyNeighborhood, getCompleteLineage]);

  const isWithinLimit = estimatedCount.nodes <= 4000 && estimatedCount.edges <= 4000;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ bgcolor: '#004B93', color: 'white', fontWeight: 'bold' }}>
        Select Levels and Hierarchy
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Please select levels and types to filter the graph. The system will display up to 4000 nodes and edges for optimal performance.
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Select Table Names
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                ({availableLevels.length} total)
              </Typography>
            </Typography>
            <Button 
              size="small" 
              onClick={() => setSelectedLevels(selectedLevels.length === availableLevels.length ? [] : availableLevels)}
            >
              {selectedLevels.length === availableLevels.length ? 'Clear All' : 'Select All'}
            </Button>
          </Box>
          <Autocomplete
            multiple
            options={availableLevels}
            value={selectedLevels}
            onChange={(_, newValue) => setSelectedLevels(newValue as string[])}
            disableCloseOnSelect
            filterOptions={levelsFilterOptions}
            PopperComponent={PopperComponent}
            ListboxProps={{ 
              style: { maxHeight: '300px' },
              onScroll: handleLevelsScroll,
              ref: levelsListboxRef,
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search and select table names..."
                variant="outlined"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...chipProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={String(option)}
                    {...chipProps}
                    color="primary"
                    size="small"
                  />
                );
              })
            }
            ListboxComponent={(props) => (
              <ul {...props}>
                {props.children}
                {displayedLevelsCount < availableLevels.length && (
                  <li style={{ padding: '8px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                    Showing {Math.min(displayedLevelsCount, (props.children as any[])?.length || 0)} of {availableLevels.length} - Scroll for more
                  </li>
                )}
              </ul>
            )}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Select Types (Table Types)
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                ({availableTypes.length} total)
              </Typography>
            </Typography>
            <Button 
              size="small" 
              onClick={() => setSelectedTypes(selectedTypes.length === availableTypes.length ? [] : availableTypes)}
            >
              {selectedTypes.length === availableTypes.length ? 'Clear All' : 'Select All'}
            </Button>
          </Box>
          <Autocomplete
            multiple
            options={availableTypes}
            value={selectedTypes}
            onChange={(_, newValue) => setSelectedTypes(newValue as string[])}
            disableCloseOnSelect
            filterOptions={typesFilterOptions}
            PopperComponent={PopperComponent}
            ListboxProps={{ 
              style: { maxHeight: '300px' },
              onScroll: handleTypesScroll,
              ref: typesListboxRef,
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search and select types..."
                variant="outlined"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...chipProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={String(option)}
                    {...chipProps}
                    color="secondary"
                    size="small"
                  />
                );
              })
            }
            ListboxComponent={(props) => (
              <ul {...props}>
                {props.children}
                {displayedTypesCount < availableTypes.length && (
                  <li style={{ padding: '8px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                    Showing {Math.min(displayedTypesCount, (props.children as any[])?.length || 0)} of {availableTypes.length} - Scroll for more
                  </li>
                )}
              </ul>
            )}
          />
        </Box>

        {selectedLevels.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={applyNeighborhood}
                  onChange={(e) => setApplyNeighborhood(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Apply Neighborhood Filter
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Show complete lineage (all ancestors and descendants) of selected table names
                  </Typography>
                </Box>
              }
            />
          </Box>
        )}

        {(selectedLevels.length > 0 || selectedTypes.length > 0) && (
          <Alert 
            severity={isWithinLimit ? "success" : "warning"}
            sx={{ mt: 2 }}
          >
            <Typography variant="body2">
              Estimated result: <strong>{estimatedCount.nodes} nodes</strong> and <strong>{estimatedCount.edges} edges</strong>
              {applyNeighborhood && selectedLevels.length > 0 && (
                <Typography component="span" sx={{ ml: 1, fontStyle: 'italic', color: 'info.main' }}>
                  (with neighborhood lineage)
                </Typography>
              )}
            </Typography>
            {!isWithinLimit && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                ⚠️ This exceeds the recommended limit. Please refine your selection for better performance.
              </Typography>
            )}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={selectedLevels.length === 0 && selectedTypes.length === 0}
          sx={{ 
            bgcolor: '#004B93',
            '&:hover': { bgcolor: '#003366' }
          }}
        >
          Generate Lineage
        </Button>
      </DialogActions>
    </Dialog>
  );
}
