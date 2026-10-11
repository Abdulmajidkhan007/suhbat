import React, { memo, useState } from 'react';
import { Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography, Tooltip } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { motion } from 'framer-motion';
import { Message } from '../../types';
import { formatDuration, formatMessageTime } from '../../utils/formatters';
import FileChip from '../common/FileChip';
import AvatarWithStatus from '../common/AvatarWithStatus';

interface Props {
  message:    Message;
  isSelf:     boolean;
  isFirst?:   boolean;
  showAvatar?: boolean;
  /** O'z matnli xabari (kanalda — yozish huquqi bor). */
  canEdit?:   boolean;
  /** O'zining yoki (guruh/kanal admini sifatida) birovning xabari. */
  canDelete?: boolean;
  onEdit?:    (messageId: string, content: string) => Promise<void>;
  onDelete?:  (messageId: string) => void;
}

const StatusIcon: React.FC<{ status: Message['status'] }> = ({ status }) => {
  // O'z xabarimiz ko'k fonda: bitta belgi — yuborildi, ikkita — o'qildi.
  if (status === 'sending')   return <DoneIcon sx={{ fontSize: 12, opacity: 0.4 }} aria-label="yuborilmoqda" />;
  if (status === 'sent')      return <DoneIcon sx={{ fontSize: 13, opacity: 0.8 }} aria-label="yuborildi" />;
  if (status === 'delivered') return <DoneAllIcon sx={{ fontSize: 13, opacity: 0.8 }} aria-label="yetkazildi" />;
  if (status === 'read')      return <DoneAllIcon sx={{ fontSize: 13, color: '#bbf7d0' }} aria-label="o'qildi" />;
  if (status === 'failed')    return <span className="text-red-200 text-xs font-bold" title="Yuborilmadi">!</span>;
  return null;
};

const Attachment: React.FC<{ message: Message }> = ({ message }) => {
  const a = message.attachment;
  if (!a) return null;
  if (a.kind === 'image') {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} (rasm)`}>
        <img
          src={a.url}
          alt={a.name}
          className="max-w-full sm:max-w-[260px] max-h-[220px] rounded-xl object-cover"
          loading="lazy"
        />
      </a>
    );
  }
  if (a.kind === 'voice') {
    return (
      <div className="flex flex-col gap-0.5">
        <audio controls preload="none" src={a.url} className="max-w-full h-9" aria-label="Ovozli xabar" />
        {a.durationMs !== null && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>{formatDuration(a.durationMs)}</Typography>
        )}
      </div>
    );
  }
  return <FileChip attachment={a} onClick={() => window.open(a.url, '_blank', 'noopener,noreferrer')} />;
};

const MessageBubble: React.FC<Props> = memo(({
  message, isSelf, showAvatar = true, canEdit = false, canDelete = false, onEdit, onDelete,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing]       = useState(false);
  const [draft, setDraft]           = useState('');
  const [saving, setSaving]         = useState(false);
  const hasMenu = !message.isOptimistic && ((canEdit && !!onEdit) || (canDelete && !!onDelete));

  const startEdit = () => {
    setMenuAnchor(null);
    setDraft(message.content);
    setEditing(true);
  };
  const saveEdit = async () => {
    const text = draft.trim();
    if (!onEdit || !text || saving) return;
    if (text === message.content) return setEditing(false);
    setSaving(true);
    try {
      await onEdit(message.id, text);
      setEditing(false);
    } catch {
      // xato matnini chaqiruvchi (ChatPage) toast bilan ko'rsatadi; tahrir ochiq qoladi
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`group flex items-end gap-2 max-w-[92%] sm:max-w-[78%] ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
    >
      {!isSelf && showAvatar ? (
        <AvatarWithStatus
          uid={message.senderId}
          displayName={message.senderName}
          photoURL={message.senderPhoto}
          showStatus={false}
          size={30}
        />
      ) : (
        !isSelf && <div className="w-[30px] flex-shrink-0" />
      )}

      <div className={`flex flex-col gap-0.5 ${isSelf ? 'items-end' : 'items-start'}`}>
        {!isSelf && showAvatar && (
          <Typography variant="caption" sx={{ px: 1, fontWeight: 600, color: 'text.secondary' }}>
            {message.senderName}
          </Typography>
        )}

        <Tooltip
          title={formatMessageTime(message.createdAt)}
          placement={isSelf ? 'left' : 'right'}
          arrow
        >
          <div
            className={`relative px-3 py-2 rounded-2xl max-w-full break-words ${
              isSelf
                ? 'rounded-br-sm bg-blue-600 text-white'
                : 'rounded-bl-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-soft'
            } ${message.isOptimistic ? 'opacity-70' : ''}`}
            style={{ minWidth: 60 }}
          >
            {editing ? (
              <div className="flex flex-col gap-1 min-w-[200px]">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveEdit(); }
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  rows={Math.min(6, Math.max(2, draft.split('\n').length))}
                  maxLength={4096}
                  aria-label="Xabarni tahrirlash"
                  className="w-full resize-none rounded-lg px-2 py-1 text-sm text-gray-900 bg-white focus:outline-none"
                />
                <div className="flex justify-end gap-1">
                  <Button size="small" onClick={() => setEditing(false)} sx={{ color: 'inherit', textTransform: 'none' }}>
                    Bekor
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="inherit"
                    disabled={saving || !draft.trim()}
                    onClick={() => void saveEdit()}
                    sx={{ textTransform: 'none', color: 'primary.main' }}
                  >
                    Saqlash
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {message.attachment && <Attachment message={message} />}
                {message.content && (
                  <Typography variant="body2" sx={{ lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap', mt: message.attachment ? 0.5 : 0 }}>
                    {message.content}
                  </Typography>
                )}
              </>
            )}

            {isSelf && (
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                {message.editedAt !== null && (
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.7 }}>tahrirlangan</Typography>
                )}
                <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.7 }}>
                  {formatMessageTime(message.createdAt)}
                </Typography>
                <StatusIcon status={message.status} />
              </div>
            )}
            {!isSelf && (
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', fontSize: '0.65rem', opacity: 0.5, mt: 0.25 }}>
                {message.editedAt !== null && 'tahrirlangan · '}
                {formatMessageTime(message.createdAt)}
              </Typography>
            )}
          </div>
        </Tooltip>
      </div>

      {hasMenu && !editing && (
        <>
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="Xabar amallari"
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
            sx={{ color: 'text.secondary', mb: 0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            slotProps={{ paper: { sx: { borderRadius: '12px', minWidth: 160 } } }}
          >
            {canEdit && onEdit && (
              <MenuItem onClick={startEdit}>
                <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Tahrirlash" />
              </MenuItem>
            )}
            {canDelete && onDelete && (
              <MenuItem onClick={() => { setMenuAnchor(null); onDelete(message.id); }} sx={{ color: 'error.main' }}>
                <ListItemIcon><DeleteOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText primary="O'chirish" />
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </motion.div>
  );
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;
