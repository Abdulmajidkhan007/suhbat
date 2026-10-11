import React from 'react';
import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setSidebarOpen } from '../../features/ui/uiSlice';
import SidebarNav from './SidebarNav';

const SIDEBAR_WIDTH     = 300;
const NAV_WIDTH         = 64;
const TOTAL_SIDEBAR_W   = SIDEBAR_WIDTH + NAV_WIDTH;

interface Props {
  sidebar: React.ReactNode;
  main:    React.ReactNode;
}

const AppShell: React.FC<Props> = ({ sidebar, main }) => {
  const dispatch    = useAppDispatch();
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const muiTheme    = useTheme();
  const isMobile    = useMediaQuery(muiTheme.breakpoints.down('md'));

  const handleClose = () => dispatch(setSidebarOpen(false));

  return (
    <Box className="flex h-screen w-full overflow-hidden" sx={{ bgcolor: 'background.default' }}>
      {/* Desktop: icon nav + panel */}
      {!isMobile && (
        <Box sx={{ width: TOTAL_SIDEBAR_W, flexShrink: 0, display: 'flex', height: '100%' }}>
          <SidebarNav />
          <Box sx={{ width: SIDEBAR_WIDTH, flexShrink: 0, height: '100%' }}>
            {sidebar}
          </Box>
        </Box>
      )}

      {/* Mobile: full-width drawer */}
      {isMobile && (
        <Drawer
          open={sidebarOpen}
          onClose={handleClose}
          variant="temporary"
          slotProps={{
            backdrop: {},
            paper: {
              sx: {
                width:    TOTAL_SIDEBAR_W,
                maxWidth: '92vw',
                display:  'flex',
                flexDirection: 'row',
                overflow: 'hidden',
              },
            },
          }}
        >
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ x: -(TOTAL_SIDEBAR_W) }}
                animate={{ x: 0 }}
                exit={{    x: -(TOTAL_SIDEBAR_W) }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                style={{ display: 'flex', width: '100%', height: '100%' }}
              >
                <SidebarNav />
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                  {sidebar}
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Drawer>
      )}

      {/* Main content */}
      <Box component="main" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {main}
      </Box>
    </Box>
  );
};

export default AppShell;
