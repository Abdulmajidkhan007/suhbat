import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, useMediaQuery } from '@mui/material';
import toast from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setActiveChat } from '../features/chats/chatsSlice';
import { setActivePanel } from '../features/ui/uiSlice';
import { signOut } from '../features/auth/authSlice';
import { canModerateMessages, canWrite } from '@suhbat/core';
import type { CallMedia } from '@suhbat/core';
import { useChats } from '../hooks/useChats';
import { useMessages } from '../hooks/useMessages';
import { usePresence } from '../hooks/usePresence';
import { useRealtime } from '../hooks/useRealtime';
import { useCall } from '../hooks/useCall';
import { callManager } from '../services/calls';
import { selectActiveChat, selectSortedChats } from '../features/chats/chatsSelectors';

import AppShell from '../components/layout/AppShell';
import Sidebar from '../components/layout/Sidebar';
import ChatHeader from '../components/layout/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageComposer from '../components/chat/MessageComposer';
import NewChatDialog from '../components/chat/NewChatDialog';
import CreateGroupDialog from '../components/chat/CreateGroupDialog';
import CreateChannelDialog from '../components/chat/CreateChannelDialog';
import ChannelSearchDialog from '../components/chat/ChannelSearchDialog';
import ChatInfoDialog from '../components/chat/ChatInfoDialog';
import ConfirmDialog from '../components/common/ConfirmDialog';
import CallOverlay from '../components/call/CallOverlay';
import { errorText } from '../utils/errors';
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
  const [groupOpen, setGroupOpen]     = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [findOpen, setFindOpen]       = useState(false);
  const [infoOpen, setInfoOpen]       = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  useRealtime(true);
  const call = useCall();
  const inCall = call !== null && call.phase !== 'ended';
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
    sendAttachment, editMessage, deleteMessage, resendMessage, discardMessage,
  } = useMessages(activeChat?.id ?? null);

  const handleSelectChat = useCallback(
    (id: string) => {
      dispatch(setActiveChat(id));
      navigate(`/${id}`);
      dispatch(setActivePanel('chats'));
    },
    [dispatch, navigate],
  );

  // Orqaga: ro'yxatga. Ro'yxatdan kelgan bo'lsak brauzer tarixida bitta qadam orqaga (tarix
  // ikkilanmaydi), to'g'ridan-to'g'ri havoladan ochilgan bo'lsa — `/`.
  const handleBack = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    callManager.hangup();
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

  const handleAttach = useCallback(async (file: File) => {
    const error = await sendAttachment(file);
    if (error) toast.error(error);
  }, [sendAttachment]);

  const handleVoice = useCallback(async ({ blob, durationMs }: { blob: Blob; durationMs: number }) => {
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    const error = await sendAttachment(blob, { kind: 'voice', name: `ovoz.${ext}`, durationMs });
    if (error) toast.error(error);
  }, [sendAttachment]);

  const handleEdit = useCallback(async (messageId: string, content: string) => {
    try {
      await editMessage(messageId, content);
    } catch (e) {
      toast.error(errorText(e, 'Xabarni tahrirlab bo\'lmadi.'));
      throw e;
    }
  }, [editMessage]);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteMessage(deleteId);
      setDeleteId(null);
    } catch (e) {
      toast.error(errorText(e, 'Xabarni o\'chirib bo\'lmadi.'));
    } finally {
      setDeleting(false);
    }
  }, [deleteId, deleteMessage]);

  const handleLeft = useCallback(() => {
    navigate('/', { replace: true });
    toast.success('Tayyor');
  }, [navigate]);

  const typingUsers = activeChat
    ? Object.entries(activeChat.typingUsers ?? {})
        .filter(([uid, isTyping]) => isTyping && uid !== user.uid)
        .map(([uid]) => activeChat.participantDetails[uid]?.displayName ?? uid)
    : [];

  const otherParticipantId = activeChat?.type === 'direct'
    ? Object.values(activeChat.participantDetails).find((p) => p.uid !== user.uid)?.uid ?? ''
    : '';
  const otherParticipant = activeChat?.participantDetails[otherParticipantId];

  const handleStartCall = (media: CallMedia) => {
    if (!activeChat || !otherParticipant) return;
    callManager
      .startCall({
        chatId: activeChat.id,
        peer:   { id: otherParticipant.uid, displayName: otherParticipant.displayName, photoUrl: otherParticipant.photoURL },
        media,
      })
      .catch((e: unknown) => toast.error(errorText(e, 'Qo\'ng\'iroq qilib bo\'lmadi.')));
  };

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
      onNewGroup={() => setGroupOpen(true)}
      onNewChannel={() => setChannelOpen(true)}
      onFindChannel={() => setFindOpen(true)}
      onSignOut={() => setSignOutOpen(true)}
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
              onBack={isMobile ? handleBack : undefined}
              onOpenInfo={() => setInfoOpen(true)}
              onStartCall={otherParticipant ? handleStartCall : undefined}
              callDisabled={inCall}
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
                canModerate={canModerateMessages(activeChat.type, activeChat.myRole)}
                canWrite={canWrite(activeChat.type, activeChat.myRole)}
                onEdit={handleEdit}
                onDelete={setDeleteId}
                onResend={(id) => void resendMessage(id)}
                onDiscard={discardMessage}
                showSenders={activeChat.type === 'group'}
              />
              <MessageComposer
                onSend={sendMessage}
                onTyping={setTyping}
                onAttach={handleAttach}
                onVoice={handleVoice}
                onError={(m) => toast.error(m)}
                readOnlyReason={canWrite(activeChat.type, activeChat.myRole) ? undefined : 'Bu kanalda faqat adminlar yozishi mumkin'}
                placeholder="Xabar yozing…"
              />
            </Box>
          </motion.div>
        ) : (
          <motion.div
            key="no-chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col h-full"
          >
            <Box className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<ForumOutlinedIcon sx={{ fontSize: 56, opacity: 0.3 }} />}
                title="Suhbat tanlang"
                description="Mavjud suhbatlardan birini tanlang yoki yangi suhbat boshlang."
                action={{ label: 'Yangi suhbat', onClick: () => setNewChatOpen(true) }}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );

  return (
    <>
      <AppShell sidebar={sidebar} main={main} mobileView={chatId && activeChat ? 'chat' : 'list'} />
      <CallOverlay />
      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onChatCreated={handleNewChatCreated}
      />
      <CreateGroupDialog open={groupOpen} onClose={() => setGroupOpen(false)} onCreated={handleNewChatCreated} />
      <CreateChannelDialog open={channelOpen} onClose={() => setChannelOpen(false)} onCreated={handleNewChatCreated} />
      <ChannelSearchDialog open={findOpen} onClose={() => setFindOpen(false)} onOpenChat={handleNewChatCreated} />
      {activeChat && activeChat.type !== 'direct' && (
        <ChatInfoDialog chat={activeChat} open={infoOpen} onClose={() => setInfoOpen(false)} onLeft={handleLeft} />
      )}
      <ConfirmDialog
        open={signOutOpen}
        destructive
        title="Hisobdan chiqilsinmi?"
        description="Qayta kirish uchun email va parol kerak bo'ladi."
        confirmLabel="Chiqish"
        onConfirm={() => {
          setSignOutOpen(false);
          void handleSignOut();
        }}
        onClose={() => setSignOutOpen(false)}
      />
      <ConfirmDialog
        open={deleteId !== null}
        destructive
        loading={deleting}
        title="Xabar o'chirilsinmi?"
        description="Xabar hamma uchun o'chadi. Buni qaytarib bo'lmaydi."
        confirmLabel="O'chirish"
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteId(null)}
      />
    </>
  );
};

export default ChatPage;
