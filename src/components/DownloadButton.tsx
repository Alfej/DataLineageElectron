import React, { useCallback } from 'react';
import { Panel } from 'reactflow';
import { toPng } from 'html-to-image';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import UndoOutlined from '@mui/icons-material/UndoOutlined';
import RedoOutlined from '@mui/icons-material/RedoOutlined';





function triggerDownload(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.setAttribute('download', fileName);
  a.setAttribute('href', dataUrl);
  a.click();
}





interface DownloadButtonProps {
  fileName?: string;
  onExpandClick?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ 
  fileName = 'graph.png',
  onExpandClick,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}) => {


  const onClick = useCallback(async () => {
    // Grab only the currently visible viewport of the flow









    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewportEl) return;
 
    try {
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => {
          // Skip anything with unwanted styling
          return !(node.nodeType === 1 && (node as HTMLElement).style.backgroundColor === 'black');
        },
        style: {
          // Force white background for all elements in the export
          backgroundColor: '#ffffff !important',
        }
      });


      triggerDownload(dataUrl, fileName);
    } catch (e) {
      console.warn('Image export failed', e);
    }
  }, [fileName]);
 
  return (
    <Panel position="top-right" style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
      {onUndo && (
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: canUndo ? '#1976d2' : '#ccc',
            color: '#fff',
            border: 'none',
            padding: '8px',
            borderRadius: 6,
            cursor: canUndo ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease-in-out',
            minWidth: '36px',
            height: '36px',
          }}
          onMouseEnter={(e) => {
            if (canUndo) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (canUndo) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
            }
          }}
          title="Undo"
        >
          <UndoOutlined fontSize="small" />
        </button>
      )}
      
      {onRedo && (
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: canRedo ? '#1976d2' : '#ccc',
            color: '#fff',
            border: 'none',
            padding: '8px',
            borderRadius: 6,
            cursor: canRedo ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease-in-out',
            minWidth: '36px',
            height: '36px',
          }}
          onMouseEnter={(e) => {
            if (canRedo) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (canRedo) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
            }
          }}
          title="Redo"
        >
          <RedoOutlined fontSize="small" />
        </button>
      )}

      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#1976d2',
          color: '#fff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 600,
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease-in-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
        }}
        title="Download PNG snapshot"
      >
        <DownloadOutlinedIcon fontSize="small" /> PNG
      </button>
      
      {onExpandClick && (
        <button
          onClick={onExpandClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            padding: '8px 10px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.8rem',
            minWidth: 'auto',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease-in-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
          }}
          title="Expand graph to fullscreen"
        >
          <FullscreenIcon fontSize="small" />
        </button>
      )}
    </Panel>
  );
};
 
export default DownloadButton;