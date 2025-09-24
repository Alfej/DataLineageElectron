import React from 'react';
import { useReactFlow } from 'reactflow';
import { IconButton, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import { styled } from '@mui/material/styles';

const ControlsContainer = styled(Box)(() => ({
  position: 'absolute',
  bottom: 16,
  left: 16,
  backgroundColor: '#e3f2fd',
  borderRadius: 8,
  padding: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  zIndex: 5,
}));

const ControlButton = styled(IconButton)(() => ({
  backgroundColor: 'transparent',
  color: '#1976d2',
  padding: '8px',
  borderRadius: '6px',
  '&:hover': {
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
    transform: 'scale(1.05)',
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
  transition: 'all 0.2s ease-in-out',
  '& .MuiSvgIcon-root': {
    fontSize: '1.2rem',
  }
}));

interface AnimatedControlsProps {
  style?: React.CSSProperties;
  onResetFilters?: () => void;
}

const AnimatedControls: React.FC<AnimatedControlsProps> = ({ style, onResetFilters }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const handleZoomIn = () => {
    zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 300 });
  };

  const handleFitView = () => {
    fitView({ 
      duration: 600,
      padding: 0.1
    });
  };

  return (
    <ControlsContainer style={style}>
      {onResetFilters && (
        <ControlButton 
          onClick={onResetFilters}
          title="Reset Graph"
          size="small"
        >
          <SettingsBackupRestoreIcon />
        </ControlButton>
      )}
      
      <ControlButton 
        onClick={handleFitView}
        title="Fit to Screen"
        size="small"
      >
        <FitScreenIcon />
      </ControlButton>
      
      <ControlButton 
        onClick={handleZoomIn}
        title="Zoom In"
        size="small"
      >
        <AddIcon />
      </ControlButton>
      
      <ControlButton 
        onClick={handleZoomOut}
        title="Zoom Out"
        size="small"
      >
        <RemoveIcon />
      </ControlButton>
    </ControlsContainer>
  );
};

export default AnimatedControls;