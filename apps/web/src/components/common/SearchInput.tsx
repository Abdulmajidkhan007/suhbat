import React from 'react';
import { InputBase, Paper, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

interface Props {
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<Props> = ({ value, onChange, placeholder = 'Search…' }) => (
  <Paper
    elevation={0}
    className="flex items-center gap-1 rounded-xl px-3 py-1"
    sx={{
      bgcolor: 'action.hover',
      border:  '1px solid transparent',
      '&:focus-within': { borderColor: 'primary.main', bgcolor: 'background.paper' },
      transition: 'all 0.2s',
    }}
  >
    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
    <InputBase
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      fullWidth
      sx={{ fontSize: '0.875rem', py: 0.25 }}
      inputProps={{ 'aria-label': placeholder }}
    />
    {value && (
      <IconButton size="small" onClick={() => onChange('')} sx={{ p: 0.25 }}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    )}
  </Paper>
);

export default SearchInput;
