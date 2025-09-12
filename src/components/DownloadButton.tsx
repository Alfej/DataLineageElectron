import React, { useCallback } from 'react';
import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from 'reactflow';
import { toPng } from 'html-to-image';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';

const IMAGE_WIDTH = 1600; // bigger export for clarity
const IMAGE_HEIGHT = 1000;

function triggerDownload(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.setAttribute('download', fileName);
  a.setAttribute('href', dataUrl);
  a.click();
}

// Optional: pad the bounds a bit
const PADDING = 40;

const DownloadButton: React.FC<{ fileName?: string }> = ({ fileName = 'graph.png' }) => {
  const { getNodes } = useReactFlow();

  const onClick = useCallback(async () => {
    const nodes = getNodes();
    if (!nodes.length) return;
    const bounds = getNodesBounds(nodes);
    // expand bounds slightly
    bounds.x -= PADDING;
    bounds.y -= PADDING;
    bounds.width += PADDING * 2;
    bounds.height += PADDING * 2;
    const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2);

    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewportEl) return;

    try {
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#ffffff',
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
        cacheBust: true,
        pixelRatio: 2,
      });
      triggerDownload(dataUrl, fileName);
    } catch (e) {
      console.warn('Image export failed', e);
    }
  }, [getNodes, fileName]);

  return (
    <Panel position="top-right">
      <button onClick={onClick} style={{
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
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
      }} title="Download PNG snapshot">
        <DownloadOutlinedIcon fontSize="small" /> PNG
      </button>
    </Panel>
  );
};

export default DownloadButton;
