import React from 'react';
import { Chip } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

interface Props {
  isOnline: boolean;
  size?:    'small' | 'medium';
}

const StatusBadge: React.FC<Props> = ({ isOnline, size = 'small' }) => (
  <Chip
    size={size}
    icon={
      <FiberManualRecordIcon
        sx={{ fontSize: '10px !important', color: isOnline ? 'success.main' : 'text.disabled' }}
      />
    }
    label={isOnline ? 'Online' : 'Offline'}
    sx={{
      bgcolor:    isOnline ? 'success.50' : 'action.hover',
      color:      isOnline ? 'success.main' : 'text.secondary',
      fontWeight: 500,
      fontSize:   '0.7rem',
      height:     20,
      border:     'none',
      '& .MuiChip-icon': { ml: 0.5 },
    }}
  />
);

export default StatusBadge;
