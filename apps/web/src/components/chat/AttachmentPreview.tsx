import React from 'react';
import { IconButton, LinearProgress, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadProgress } from '../../types';

interface Props {
  uploads:       UploadProgress[];
  onRemove:      (id: string) => void;
  pendingFiles?: File[];
  onRemoveFile?: (index: number) => void;
}

const FilePreviewCard: React.FC<{ upload: UploadProgress; onRemove: () => void }> = ({
  upload,
  onRemove,
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.9, y: 8 }}
    animate={{ opacity: 1, scale: 1,   y: 0 }}
    exit={{    opacity: 0, scale: 0.9, y: 8 }}
    className="relative flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 min-w-[160px] max-w-[220px]"
  >
    <InsertDriveFileIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
    <div className="flex-1 min-w-0">
      <Typography variant="caption" noWrap sx={{ fontWeight: 500, display: 'block' }}>
        {upload.fileName}
      </Typography>
      {upload.status === 'uploading' && (
        <LinearProgress
          variant="determinate"
          value={upload.progress}
          sx={{ height: 3, borderRadius: 2, mt: 0.5 }}
        />
      )}
      {upload.status === 'error' && (
        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
          Upload failed
        </Typography>
      )}
    </div>
    <IconButton size="small" onClick={onRemove} sx={{ p: 0.25, flexShrink: 0 }}>
      <CloseIcon sx={{ fontSize: 14 }} />
    </IconButton>
  </motion.div>
);

const AttachmentPreview: React.FC<Props> = ({ uploads, onRemove }) => {
  if (uploads.length === 0) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{    height: 0, opacity: 0 }}
      className="flex flex-wrap gap-2 px-4 py-2 border-t border-gray-100 dark:border-gray-800"
    >
      <AnimatePresence>
        {uploads.map((u) => (
          <FilePreviewCard key={u.id} upload={u} onRemove={() => onRemove(u.id)} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default AttachmentPreview;
