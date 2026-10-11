import React from 'react';
import { Box, IconButton, Tooltip, Avatar, Divider } from '@mui/material';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setActivePanel } from '../../features/ui/uiSlice';
import { getAvatarColor } from '../../utils/colors';
import { getInitials } from '../../utils/formatters';
import type { UIState } from '../../types';

const SidebarNav: React.FC = () => {
  const dispatch    = useAppDispatch();
  const activePanel = useAppSelector((s) => s.ui.activePanel);
  const user        = useAppSelector((s) => s.auth.user)!;

  const navItems: { panel: UIState['activePanel']; icon: React.ReactNode; label: string }[] = [
    { panel: 'chats',    icon: <ForumOutlinedIcon fontSize="small" />,    label: 'Messages' },
    { panel: 'settings', icon: <SettingsOutlinedIcon fontSize="small" />, label: 'Settings' },
  ];

  return (
    <Box
      className="flex flex-col items-center py-3 gap-1"
      sx={{
        width:       64,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor:     'background.paper',
        flexShrink:  0,
        height:      '100%',
      }}
    >
      {/* App logo */}
      <Box
        className="flex items-center justify-center rounded-xl mb-2"
        sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}
      >
        <ForumOutlinedIcon sx={{ color: 'white', fontSize: 18 }} />
      </Box>

      <Divider sx={{ width: '60%', mb: 1 }} />

      {navItems.map(({ panel, icon, label }) => (
        <Tooltip key={panel} title={label} placement="right" arrow>
          <IconButton
            onClick={() => dispatch(setActivePanel(panel))}
            sx={{
              width:   44,
              height:  44,
              borderRadius: '12px',
              color:   activePanel === panel ? 'primary.main' : 'text.secondary',
              bgcolor: activePanel === panel ? 'primary.50' : 'transparent',
              '&:hover': { bgcolor: activePanel === panel ? 'primary.100' : 'action.hover' },
              transition: 'all 0.15s',
            }}
            aria-label={label}
            aria-pressed={activePanel === panel}
          >
            {icon}
          </IconButton>
        </Tooltip>
      ))}

      <Box className="flex-1" />

      {/* User avatar at bottom */}
      <Tooltip title={user.displayName} placement="right" arrow>
        <Avatar
          src={user.photoURL ?? undefined}
          onClick={() => dispatch(setActivePanel('settings'))}
          sx={{
            width:   36,
            height:  36,
            bgcolor: getAvatarColor(user.uid),
            fontWeight: 600,
            fontSize:   '0.8rem',
            cursor:     'pointer',
            border:     activePanel === 'settings' ? '2px solid' : '2px solid transparent',
            borderColor: activePanel === 'settings' ? 'primary.main' : 'transparent',
            transition:  'border-color 0.15s',
          }}
        >
          {!user.photoURL && getInitials(user.displayName)}
        </Avatar>
      </Tooltip>
    </Box>
  );
};

export default SidebarNav;
