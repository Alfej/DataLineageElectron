import React, { useState } from 'react';
import { Box, Select, MenuItem, Button, Typography } from '@mui/material';

const directions = [
  { key: 'TB', label: 'Top → Bottom (TB)' },
  { key: 'BT', label: 'Bottom → Top (BT)' },
  { key: 'LR', label: 'Left → Right (LR)' },
  { key: 'RL', label: 'Right → Left (RL)' },
];

type Props = {
  value: string;
  onChange: (d: string) => void;
  onApply: () => void;
};

const LayoutDirection: React.FC<Props> = ({ value, onChange, onApply }) => {
  const [local, setLocal] = useState<string>(value || 'TB');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ color: '#666' }}>Layout</Typography>
      <Select size="small" value={local} onChange={(e) => { setLocal(String(e.target.value)); onChange(String(e.target.value)); }}>
        {directions.map(d => (
          <MenuItem key={d.key} value={d.key}>{d.label}</MenuItem>
        ))}
      </Select>
      <Button size="small" variant="contained" onClick={onApply} sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#115293' } }}>Apply</Button>
    </Box>
  );
};

export default LayoutDirection;
