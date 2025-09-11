import { Box, Typography } from '@mui/material';
import type { TableRelation } from './graphModel';

export default function TooltipContent({ node }: { node: any }) {
  return (
    <Box sx={{ p: 1, color: '#0d47a1' }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#002e5b' }}>
        {node.data.label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, color: '#333' }}>
        Relationships:
      </Typography>
      {node.data.details?.map((detail: TableRelation, idx: number) => (
        <Box key={idx} sx={{ ml: 1, mt: 0.5 }}>
          <Typography variant="body2" sx={{ color: '#111' }}>
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
          <Typography variant="body2" sx={{ color: '#444' }}>• Relationship: {detail.relationship}</Typography>
          <Typography variant="body2" sx={{ color: '#444' }}>• Client ID: {detail.ClientID}</Typography>
          <Typography variant="body2" sx={{ color: '#444' }}>• App ID: {detail.AppID}</Typography>
        </Box>
      ))}
    </Box>
  );
}
