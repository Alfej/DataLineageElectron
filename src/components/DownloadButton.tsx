import React, { useCallback } from 'react';
import { Panel } from 'reactflow';
import { toPng } from 'html-to-image';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
 
function triggerDownload(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.setAttribute('download', fileName);
  a.setAttribute('href', dataUrl);
  a.click();
}
 
const DownloadButton: React.FC<{ fileName?: string }> = ({ fileName = 'graph.png' }) => {
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
      });
 
      triggerDownload(dataUrl, fileName);
    } catch (e) {
      console.warn('Image export failed', e);
    }
  }, [fileName]);
 
  return (
    <Panel position="top-right">
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
        }}
        title="Download PNG snapshot"
      >
        <DownloadOutlinedIcon fontSize="small" /> PNG
      </button>
    </Panel>
  );
};
 
export default DownloadButton;