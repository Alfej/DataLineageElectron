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
      // Temporarily fix edge label styling before export
      const edgeTexts = viewportEl.querySelectorAll('.react-flow__edge-text');
      const edgeTextBgs = viewportEl.querySelectorAll('.react-flow__edge-textbg');
      
      const originalStyles: Array<{ element: HTMLElement, originalStyle: string }> = [];
      
      // Fix edge text styling
      edgeTexts.forEach((textEl) => {
        const htmlEl = textEl as HTMLElement;
        originalStyles.push({ element: htmlEl, originalStyle: htmlEl.style.cssText });
        htmlEl.style.fill = '#333';
        htmlEl.style.fontSize = '12px';
        htmlEl.style.fontWeight = '600';
      });
      
      // Fix edge text background styling
      edgeTextBgs.forEach((bgEl) => {
        const htmlEl = bgEl as HTMLElement;
        originalStyles.push({ element: htmlEl, originalStyle: htmlEl.style.cssText });
        htmlEl.style.fill = 'rgba(255, 255, 255, 0.9)';
        htmlEl.style.stroke = 'rgba(255, 255, 255, 0.9)';
        htmlEl.style.strokeWidth = '2px';
      });

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
      });
      
      // Restore original styles
      originalStyles.forEach(({ element, originalStyle }) => {
        element.style.cssText = originalStyle;
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