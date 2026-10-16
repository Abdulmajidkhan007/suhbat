import React from 'react';
import { BottomNavigation, BottomNavigationAction, Box, useMediaQuery, useTheme } from '@mui/material';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setActivePanel } from '../../features/ui/uiSlice';
import SidebarNav from './SidebarNav';

const SIDEBAR_WIDTH   = 300;
const NAV_WIDTH       = 64;
const TOTAL_SIDEBAR_W = SIDEBAR_WIDTH + NAV_WIDTH;

interface Props {
  sidebar: React.ReactNode;
  main:    React.ReactNode;
  /**
   * Faqat kichik ekranda: qaysi ko'rinish to'liq ekran turadi (Telegram mobil veb kabi) —
   * suhbatlar ro'yxati yoki ochiq chat. Keng ekranda ikkalasi yonma-yon.
   */
  mobileView: 'list' | 'chat';
}

const AppShell: React.FC<Props> = ({ sidebar, main, mobileView }) => {
  const dispatch    = useAppDispatch();
  const activePanel = useAppSelector((s) => s.ui.activePanel);
  const muiTheme    = useTheme();
  const isMobile    = useMediaQuery(muiTheme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Box className="flex flex-col w-full overflow-hidden" sx={{ height: '100dvh', bgcolor: 'background.default' }}>
        {mobileView === 'list' ? (
          <>
            <Box className="flex-1 min-h-0 overflow-hidden" sx={{ width: '100%' }}>{sidebar}</Box>
            <BottomNavigation
              showLabels
              value={activePanel}
              onChange={(_, panel: 'chats' | 'settings') => dispatch(setActivePanel(panel))}
              sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
            >
              <BottomNavigationAction value="chats" label="Suhbatlar" icon={<ForumOutlinedIcon fontSize="small" />} />
              <BottomNavigationAction value="settings" label="Sozlamalar" icon={<SettingsOutlinedIcon fontSize="small" />} />
            </BottomNavigation>
          </>
        ) : (
          <Box component="main" className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">{main}</Box>
        )}
      </Box>
    );
  }

  return (
    <Box className="flex w-full overflow-hidden" sx={{ height: '100dvh', bgcolor: 'background.default' }}>
      <Box sx={{ width: TOTAL_SIDEBAR_W, flexShrink: 0, display: 'flex', height: '100%' }}>
        <SidebarNav />
        <Box sx={{ width: SIDEBAR_WIDTH, flexShrink: 0, height: '100%' }}>{sidebar}</Box>
      </Box>
      <Box component="main" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {main}
      </Box>
    </Box>
  );
};

export default AppShell;
