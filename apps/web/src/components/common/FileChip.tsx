import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { formatFileSize } from '../../utils/formatters';
import { Attachment } from '../../types';

interface Props {
  attachment: Attachment;
  onClick?:   () => void;
}

const FileChip: React.FC<Props> = ({ attachment, onClick }) => (
  <Tooltip title={`${attachment.name} (${formatFileSize(attachment.size)})`} arrow>
    <Chip
      icon={<AttachFileIcon sx={{ fontSize: '14px !important' }} />}
      label={attachment.name.length > 20 ? attachment.name.slice(0, 18) + '…' : attachment.name}
      size="small"
      onClick={onClick}
      clickable={!!onClick}
      sx={{
        maxWidth:   200,
        fontSize:   '0.75rem',
        fontWeight: 500,
        bgcolor:    'action.hover',
        '&:hover':  { bgcolor: 'action.selected' },
        cursor:     onClick ? 'pointer' : 'default',
      }}
    />
  </Tooltip>
);

export default FileChip;
