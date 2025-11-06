import { BaseEdge, EdgeLabelRenderer, EdgeProps } from 'reactflow';

export default function SelfLoopEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, style, markerEnd, label } = props;
  const offset = 40;
  const path = `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY - offset}, ${sourceX + offset} ${sourceY + offset}, ${sourceX} ${sourceY}`;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(${sourceX + offset + 6}px, ${sourceY}px)`,
              background: 'white',
              padding: '2px 6px',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: 12,
              pointerEvents: 'all',
              whiteSpace: 'nowrap'
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
