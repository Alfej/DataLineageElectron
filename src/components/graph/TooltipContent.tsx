import { Box, Typography } from '@mui/material';
import type { TableRelation } from './graphModel';

export default function TooltipContent({ node }: { node: any }) {
  return (
    <Box sx={{ 
      width: 300, // Fixed width
      maxHeight: 250, // Fixed max height
      display: 'flex',
      flexDirection: 'column',
      color: '#0d47a1'
    }}>
      {/* Header - Fixed at top */}
      <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#002e5b' }}>
          {node.data.label}
        </Typography>
      </Box>
      
      {/* Scrollable Content */}
      <Box sx={{ 
        flex: 1,
        overflowY: 'auto',
        p: 1,
        maxHeight: 180, // Reserve space for header and button
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f1f1',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#c1c1c1',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: '#a8a8a8',
        },
      }}>
        <Typography variant="body2" sx={{ mb: 1, color: '#333', fontWeight: 'bold' }}>
          Relationships:
        </Typography>
        {node.data.details?.map((detail: TableRelation, idx: number) => (
          <Box key={idx} sx={{ ml: 1, mb: 1, pb: 1, borderBottom: idx < node.data.details.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            <Typography variant="body2" sx={{ color: '#111', mb: 0.5 }}>
              {detail.childTableName === node.id ? (
                <>
                  <span style={{ color: '#004B93', fontWeight: '700' }}>Child → Parent</span>: {detail.parentTableName}
                </>
              ) : (
                <>
                  <span style={{ color: '#004B93', fontWeight: '700' }}>Parent → Child</span>: {detail.childTableName}
                </>
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: '#444', fontSize: '0.75rem' }}>• Relationship: {detail.relationship}</Typography>
            <Typography variant="body2" sx={{ color: '#444', fontSize: '0.75rem' }}>• Client ID: {detail.ClientID}</Typography>
            <Typography variant="body2" sx={{ color: '#444', fontSize: '0.75rem' }}>• App ID: {detail.AppID}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
