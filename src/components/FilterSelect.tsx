import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Box, FormControl, Select, MenuItem, Checkbox, ListItemText, Typography, TextField, InputAdornment } from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

type Props = {
  title: string;
  options: string[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholderAllText?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
};

const FilterSelect: React.FC<Props> = ({ title, options, value, onChange, placeholderAllText = 'All', disabled = false, size = 'small' }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      // focus the search input after menu opens
      setTimeout(() => {
        try { inputRef.current?.focus(); } catch { }
      }, 50);
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter((o) => String(o).toLowerCase().includes(s));
  }, [options, search]);

  const handleChange = (e: any) => {
    const raw = typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]);
    if (raw.includes('ALL')) onChange([]);
    else onChange(raw);
  };
  const handleOpen = () => setOpen(true);
  const handleClose = () => { setOpen(false); setSearch(''); };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5, color: '#333' }}>{title}</Typography>
      <FormControl fullWidth size={size}>
        <Select
          multiple
          value={value}
          onChange={handleChange}
            open={open}
            onOpen={handleOpen}
            onClose={handleClose}
            displayEmpty
            renderValue={(selected) => {
              // handle null/undefined and empty array
              if (!selected || (Array.isArray(selected) && selected.length === 0)) return placeholderAllText;
              const selCount = Array.isArray(selected) ? selected.length : 0;
              return selCount === 0 ? placeholderAllText : `${selCount}/${options.length} selected`;
            }}
          disabled={disabled}
          MenuProps={{
            PaperProps: { sx: { maxHeight: 320 } }
          }}
        >
          {/* Search input inside the dropdown */}
          <MenuItem disableRipple sx={{ pointerEvents: 'auto', cursor: 'default' }}>
            <Box sx={{ width: '100%' }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputRef={inputRef}
                onKeyDown={(e) => e.stopPropagation()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </MenuItem>

          <MenuItem value="ALL">
            <Checkbox checked={value.length === 0} indeterminate={value.length > 0 && value.length < options.length} />
            <ListItemText primary={placeholderAllText} />
          </MenuItem>

          {filteredOptions.length === 0 && (
            <MenuItem disabled>
              <ListItemText primary="No results" />
            </MenuItem>
          )}

          {filteredOptions.map((opt) => (
            <MenuItem key={opt} value={opt}>
              <Checkbox checked={value.includes(opt)} />
              <ListItemText primary={opt} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default FilterSelect;
