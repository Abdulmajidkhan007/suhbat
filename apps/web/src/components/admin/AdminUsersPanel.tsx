// src/components/admin/AdminUsersPanel.tsx — foydalanuvchilar jadvali: qidiruv, sahifalash, ko'plab o'chirish, qator amallari.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, IconButton, ListItemText, Menu, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import toast from 'react-hot-toast';
import type { AdminUser, AdminUserList } from '@suhbat/core';
import { useAppSelector } from '../../app/hooks';
import { useDebounce } from '../../hooks/useDebounce';
import { api } from '../../services/api';
import { errorText } from '../../utils/errors';
import ConfirmDialog from '../common/ConfirmDialog';
import SearchInput from '../common/SearchInput';
import { ACTIONS, runAction, who } from './adminActions';
import type { AdminActionKind } from './adminActions';
import SecretDialog from './SecretDialog';

const PAGE_SIZE = 20;
const MENU_ORDER: AdminActionKind[] = ['tempPassword', 'recoveryCodes', 'revoke', 'block', 'unblock', 'delete'];

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const menuFor = (u: AdminUser): AdminActionKind[] =>
  MENU_ORDER.filter((k) => (k === 'block' ? !u.blocked : k === 'unblock' ? u.blocked : true));

interface Pending {
  kind: AdminActionKind;
  user: AdminUser;
}
interface Secret {
  title:  string;
  values: string[];
  note:   string;
}

const AdminUsersPanel: React.FC = () => {
  const meId = useAppSelector((s) => s.auth.user?.uid);
  const [query, setQuery] = useState('');
  const q = useDebounce(query.trim(), 300);
  const [page, setPage] = useState(0); // MUI: 0 dan boshlanadi
  const [data, setData] = useState<AdminUserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ anchor: HTMLElement; user: AdminUser } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.admin.listUsers({ q, page: page + 1, pageSize: PAGE_SIZE }));
    } catch (e) {
      setError(errorText(e, 'Ro\'yxatni yuklab bo\'lmadi.'));
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => { void load(); }, [load]);
  // Boshqa sahifa/qidiruv — tanlov saqlanmaydi (ko'rinmaydigan qatorlar o'chib ketmasin).
  useEffect(() => { setSelected(new Set()); }, [q, page]);
  useEffect(() => { setPage(0); }, [q]);

  const items = data?.items ?? [];
  const selectable = items.filter((u) => u.id !== meId);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((u) => u.id)));

  const confirmAction = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const values = await runAction(pending.kind, pending.user.id);
      const spec = ACTIONS[pending.kind];
      if (values) {
        setSecret({
          title: pending.kind === 'tempPassword' ? 'Vaqtinchalik parol' : 'Yangi tiklash kodlari',
          values,
          note: pending.kind === 'tempPassword'
            ? `${who(pending.user)} uchun parol. U faqat shu yerda, bir marta ko'rsatiladi — foydalanuvchiga yetkazing. Kirgach u yangi parol o'rnatishi shart.`
            : `${who(pending.user)} uchun kodlar. Ular faqat shu yerda, bir marta ko'rsatiladi; har biri bir marta ishlaydi.`,
        });
      } else {
        toast.success(`${spec.label}: ${who(pending.user)}`);
      }
      setPending(null);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Amal bajarilmadi.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmBulk = async () => {
    setBusy(true);
    try {
      const res = await api.admin.bulkDelete([...selected]);
      toast.success(`${res.deleted.length} ta foydalanuvchi o'chirildi`);
      setBulkOpen(false);
      setSelected(new Set());
      // Oxirgi sahifadagi hamma o'chgan bo'lsa — oldingisiga.
      if (res.deleted.length >= items.length && page > 0) setPage(page - 1);
      else await load();
    } catch (e) {
      toast.error(errorText(e, 'O\'chirib bo\'lmadi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Box className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Box sx={{ flex: 1, maxWidth: { sm: 420 } }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Ism, username yoki email" />
        </Box>
        {selected.size > 0 && (
          <Box className="flex items-center gap-2 sm:ml-auto">
            <Typography variant="body2" color="text.secondary">{selected.size} ta tanlandi</Typography>
            <Button
              color="error" variant="contained" size="small" startIcon={<DeleteOutlinedIcon fontSize="small" />}
              onClick={() => setBulkOpen(true)} sx={{ textTransform: 'none', borderRadius: '10px' }}
            >
              O'chirish
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Qayta</Button>} sx={{ borderRadius: '10px' }}>
          {error}
        </Alert>
      )}

      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper', position: 'relative' }}>
        <Table size="small" aria-label="Foydalanuvchilar">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected} indeterminate={someSelected} onChange={toggleAll}
                  disabled={selectable.length === 0} slotProps={{ input: { 'aria-label': 'Hammasini tanlash' } }}
                />
              </TableCell>
              <TableCell>Foydalanuvchi</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Ro'yxatdan o'tgan</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Oxirgi faollik</TableCell>
              <TableCell>Holat</TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((u) => {
              const isMe = u.id === meId;
              return (
                <TableRow key={u.id} hover selected={selected.has(u.id)} sx={{ opacity: u.blocked ? 0.7 : 1 }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.has(u.id)} onChange={() => toggle(u.id)} disabled={isMe}
                      slotProps={{ input: { 'aria-label': `Tanlash: ${who(u)}` } }}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: { xs: 180, sm: 320 } }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {u.displayName}{isMe ? ' (siz)' : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                      {u.username ? `@${u.username} · ` : ''}{u.email}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>{formatDate(u.createdAt)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap' }}>{formatDate(u.lastSeenAt)}</TableCell>
                  <TableCell>
                    <Box className="flex flex-wrap gap-1">
                      {u.isAdmin && <Chip size="small" color="primary" label="admin" />}
                      {u.blocked && <Chip size="small" color="error" label="bloklangan" />}
                      {u.mustChangePassword && <Chip size="small" color="warning" label="parol almashtirilmagan" />}
                      <Chip size="small" variant="outlined" label={`${u.activeSessions} sessiya`} />
                      <Chip size="small" variant="outlined" color={u.hasRecoveryCodes ? 'success' : 'default'} label={u.hasRecoveryCodes ? 'kodlar bor' : 'kodsiz'} />
                    </Box>
                  </TableCell>
                  <TableCell padding="checkbox">
                    <Tooltip title="Amallar">
                      <IconButton size="small" aria-label={`Amallar: ${who(u)}`} onClick={(e) => setMenu({ anchor: e.currentTarget, user: u })}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && items.length === 0 && !error && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {q ? 'Hech narsa topilmadi' : 'Foydalanuvchilar yo\'q'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {loading && (
          <Box className="flex justify-center py-3"><CircularProgress size={22} aria-label="Yuklanmoqda" /></Box>
        )}
        <TablePagination
          component="div" count={data?.total ?? 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
      </TableContainer>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu && menuFor(menu.user).map((kind) => {
          const spec = ACTIONS[kind];
          const disabled = spec.notSelf && menu.user.id === meId;
          return (
            <MenuItem
              key={kind} disabled={disabled}
              onClick={() => { setPending({ kind, user: menu.user }); setMenu(null); }}
              sx={spec.destructive && kind === 'delete' ? { color: 'error.main' } : undefined}
            >
              <ListItemText>{spec.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTIONS[pending.kind].title(pending.user) : ''}
        description={pending ? ACTIONS[pending.kind].description : undefined}
        confirmLabel={pending ? ACTIONS[pending.kind].confirmLabel : undefined}
        destructive={pending ? ACTIONS[pending.kind].destructive : false}
        loading={busy}
        onConfirm={() => void confirmAction()}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={bulkOpen}
        title={`${selected.size} ta foydalanuvchi o'chiriladi`}
        description="Ularning hisoblari, xabarlari, 1:1 chatlari va fayllari o'chadi. Bu amalni qaytarib bo'lmaydi."
        confirmLabel="O'chirish"
        destructive
        loading={busy}
        onConfirm={() => void confirmBulk()}
        onClose={() => setBulkOpen(false)}
      />
      <SecretDialog
        open={secret !== null} title={secret?.title ?? ''} description={secret?.note ?? ''} values={secret?.values ?? []}
        onClose={() => setSecret(null)}
      />
    </div>
  );
};

export default AdminUsersPanel;
