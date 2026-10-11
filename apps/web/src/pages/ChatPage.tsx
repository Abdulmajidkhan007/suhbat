import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, useMediaQuery } from '@mui/material';
import toast from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setActiveChat } from '../features/chats/chatsSlice';
import { setSidebarOpen } from '../features/ui/uiSlice';
import { signOut } from '../features/auth/authSlice';
import { useChats } from '../hooks/useChats';
import { useMessages } from '../hooks/useMessages';
import { usePresence } from '../hooks/usePresence';
import { useRealtime } from '../hooks/useRealtime';
import { selectActiveChat, selectSortedChats } from '../features/chats/chatsSelectors';

import AppShell from '../components/layout/AppShell';
import Sidebar from '../components/layout/Sidebar';
import ChatHeader from '../components/layout/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageComposer from '../components/chat/MessageComposer';
import NewChatDialog from '../components/chat/NewChatDialog';
import EmptyState from '../components/ui/EmptyState';

import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';

const ChatPage: React.FC = () => {
  const dispatch   = useAppDispatch();
  const navigate   = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  const muiTheme   = useTheme();
  const isMobile   = useMediaQuery(muiTheme.breakpoints.down('md'));

  const user       = useAppSelector((s) => s.auth.user)!;
  const activeChat = useAppSelector(selectActiveChat);
  const chats      = useAppSelector(selectSortedChats);

  const [newChatOpen, setNewChatOpen] = useState(false);

  useRealtime(true);
  const chatsState = useChats();
  const { onlineUsers, isOnline } = usePresence();

  useEffect(() => {
    if (chatId) {
      dispatch(setActiveChat(chatId));
    } else if (!isMobile && chats.length > 0) {
      navigate(`/${chats[0].id}`, { replace: true });
    } else {
      dispatch(setActiveChat(null));
    }
  }, [chatId, chats, dispatch, navigate, isMobile]);

  const {
    messages, loading: msgLoading, error: msgError, hasOlder, loadingOlder, loadOlder, sendMessage, setTyping,
  } = useMessages(activeChat?.id ?? null);

  const handleSelectChat = useCallback(
    (id: string) => {
      dispatch(setActiveChat(id));
      navigate(`/${id}`);
      if (isMobile) dispatch(setSidebarOpen(false));
    },
    [dispatch, navigate, isMobile],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await dispatch(signOut());
      navigate('/login');
    } catch {
      toast.error('Chiqishda xato.');
    }
  }, [dispatch, navigate]);

  const handleNewChatCreated = useCallback(
    (id: string) => {
      handleSelectChat(id);
    },
    [handleSelectChat],
  );

  const handleAttach = useCallback(async (_file: File) => {
    toast('Fayl yuborish 2-fazada qo\'shiladi.', { icon: '📎' });
  }, []);

  const typingUsers = activeChat
    ? Object.entries(activeChat.typingUsers ?? {})
        .filter(([uid, isTyping]) => isTyping && uid !== user.uid)
        .map(([uid]) => activeChat.participantDetails[uid]?.displayName ?? uid)
    : [];

  const otherParticipantId = activeChat?.type === 'direct'
    ? Object.values(activeChat.participantDetails).find((p) => p.uid !== user.uid)?.uid ?? ''
    : '';

  const sidebar = (
    <Sidebar
      user={user}
      chats={chats}
      activeChatId={chatsState.activeChatId}
      loading={chatsState.loading}
      error={chatsState.error}
      onlineUsers={onlineUsers}
      onSelectChat={handleSelectChat}
      onNewChat={() => setNewChatOpen(true)}
      onSignOut={handleSignOut}
      onRetryChats={chatsState.retry}
    />
  );

  const main = (
    <Box className="flex flex-col h-full">
      <AnimatePresence mode="wait">
        {activeChat ? (
          <motion.div
            key={activeChat.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col h-full"
          >
            <ChatHeader
              chat={activeChat}
              currentUid={user.uid}
              isOnline={isOnline(otherParticipantId)}
              onMenuClick={() => dispatch(setSidebarOpen(true))}
              showMenuButton={isMobile}
            />
            <Box className="flex-1 flex flex-col overflow-hidden">
              <MessageList
                messages={messages}
                currentUserId={user.uid}
                loading={msgLoading}
                error={msgError}
                typingNames={typingUsers}
                hasOlder={hasOlder}
                loadingOlder={loadingOlder}
                onLoadOlder={loadOlder}
              />
              <MessageComposer
                onSend={sendMessage}
                onTyping={setTyping}
                onAttach={handleAttach}
                placeholder="Xabar yozing…"
              />
            </Box>
          </motion.div>
        ) : (
          <motion.div
            key="no-chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <EmptyState
              icon={<ForumOutlinedIcon sx={{ fontSize: 56, opacity: 0.3 }} />}
              title="Suhbat tanlang"
              description="Mavjud suhbatlardan birini tanlang yoki yangi suhbat boshlang."
              action={{ label: 'Yangi suhbat', onClick: () => setNewChatOpen(true) }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );

  return (
    <>
      <AppShell sidebar={sidebar} main={main} />
      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onChatCreated={handleNewChatCreated}
      />
    </>
  );
};

export default ChatPage;
