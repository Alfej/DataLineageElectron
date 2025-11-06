import { Handle, Position } from 'reactflow';

function FourHandleNode({ data }: any) {
  return (
    <div style={{ width: "100%", padding: 8, borderRadius: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {data?.label}

      {/* target handles (ids match position names so edges can reference 'top'|'left'|'right'|'bottom') */}
      <Handle id="top" type="target" position={Position.Top} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />
      <Handle id="left" type="target" position={Position.Left} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />
      <Handle id="right" type="target" position={Position.Right} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />
      <Handle id="bottom" type="target" position={Position.Bottom} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />

      {/* source handles */}
      <Handle id="top" type="source" position={Position.Top} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />
      <Handle id="left" type="source" position={Position.Left} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />
      <Handle id="right" type="source" position={Position.Right} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ width: 0, height: 0, opacity: 0, background: 'transparent', border: 'none', pointerEvents: 'none' }} />
    </div>
  );
}

export default FourHandleNode;
