import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CallState } from '@suhbat/client';
import ChatHeader from '../layout/ChatHeader';
import SystemMessage from '../chat/SystemMessage';
import type { Chat, Message } from '../../types';
import CallScreen from './CallScreen';
import IncomingCallDialog from './IncomingCallDialog';

const peer = { id: 'u-vali', displayName: 'Vali', photoUrl: null };

const state = (patch: Partial<CallState<MediaStream>> = {}): CallState<MediaStream> => ({
  phase: 'calling', callId: 'c1', chatId: 'chat-1', media: 'audio', direction: 'outgoing', peer,
  remoteRinging: false, reconnecting: false, connectedAt: null, muted: false, cameraOff: false,
  localStream: null, remoteStream: null, endReason: null, error: null,
  ...patch,
});

const handlers = () => ({
  onHangup:       vi.fn(),
  onToggleMute:   vi.fn(),
  onToggleCamera: vi.fn(),
  onSwitchCamera: vi.fn(),
  onClose:        vi.fn(),
});

describe('IncomingCallDialog', () => {
  it('ism, turi va qabul/rad tugmalari', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<IncomingCallDialog open peer={peer} media="video" onAccept={onAccept} onReject={onReject} />);
    expect(screen.getByText('Vali')).toBeInTheDocument();
    expect(screen.getByText('Kiruvchi video qo\'ng\'iroq')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Qabul qilish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rad etish' }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledOnce();
  });
});

describe('CallScreen', () => {
  it('chiquvchi: "Jiringlamoqda…", ovozli qo\'ng\'iroqda kamera tugmasi yo\'q, tugatish', () => {
    const h = handlers();
    render(<CallScreen state={state({ remoteRinging: true })} canSwitchCamera={false} {...h} />);
    expect(screen.getByRole('status')).toHaveTextContent('Jiringlamoqda…');
    expect(screen.queryByRole('button', { name: 'Kamerani o\'chirish' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tugatish' }));
    expect(h.onHangup).toHaveBeenCalledOnce();
  });

  it('ulangan video: taymer, mikrofon/kamera holati, kamerani almashtirish', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const h = handlers();
    const { rerender } = render(
      <CallScreen state={state({ phase: 'connected', media: 'video', connectedAt: 100_000 - 192_000, muted: true })} canSwitchCamera {...h} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('3:12');
    const mic = screen.getByRole('button', { name: 'Mikrofonni yoqish' });
    expect(mic).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(mic);
    fireEvent.click(screen.getByRole('button', { name: 'Kamerani o\'chirish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kamerani almashtirish' }));
    expect(h.onToggleMute).toHaveBeenCalledOnce();
    expect(h.onToggleCamera).toHaveBeenCalledOnce();
    expect(h.onSwitchCamera).toHaveBeenCalledOnce();

    rerender(<CallScreen state={state({ phase: 'connected', media: 'video', connectedAt: 100_000, reconnecting: true })} canSwitchCamera {...h} />);
    expect(screen.getByRole('status')).toHaveTextContent('Aloqa tiklanmoqda…');
    vi.useRealTimers();
  });

  it('tugagan: sabab yoki xato matni, boshqaruv tugmalari o\'rniga "Yopish"', () => {
    const h = handlers();
    render(<CallScreen state={state({ phase: 'ended', endReason: 'error', error: 'Mikrofonga ruxsat berilmadi' })} canSwitchCamera={false} {...h} />);
    expect(screen.getByRole('status')).toHaveTextContent('Mikrofonga ruxsat berilmadi');
    expect(screen.queryByRole('button', { name: 'Tugatish' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }));
    expect(h.onClose).toHaveBeenCalledOnce();
  });
});

const chat = (type: Chat['type']): Chat => ({
  id: 'chat-1', name: 'Vali', type, photoURL: null, participants: ['me', 'u-vali'], myRole: 'member',
  participantDetails: {
    'me':     { uid: 'me', displayName: 'Men', photoURL: null, isOnline: true, lastSeen: 0 },
    'u-vali': { uid: 'u-vali', displayName: 'Vali', photoURL: null, isOnline: true, lastSeen: 0 },
  },
  lastMessage: null, unreadCount: 0, createdAt: 0, updatedAt: 0, typingUsers: {},
});

describe('ChatHeader qo\'ng\'iroq tugmalari', () => {
  const base = { currentUid: 'me', isOnline: true, onMenuClick: () => undefined, showMenuButton: false };

  it('1:1 chatda ovozli va video qo\'ng\'iroq boshlaydi; band bo\'lsa o\'chiq', () => {
    const onStartCall = vi.fn();
    const { rerender } = render(<ChatHeader chat={chat('direct')} {...base} onStartCall={onStartCall} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ovozli qo\'ng\'iroq' }));
    fireEvent.click(screen.getByRole('button', { name: 'Video qo\'ng\'iroq' }));
    expect(onStartCall.mock.calls).toEqual([['audio'], ['video']]);

    rerender(<ChatHeader chat={chat('direct')} {...base} onStartCall={onStartCall} callDisabled />);
    expect(screen.getByRole('button', { name: 'Ovozli qo\'ng\'iroq' })).toBeDisabled();
  });

  it('guruhda tugmalar yo\'q', () => {
    render(<ChatHeader chat={chat('group')} {...base} onStartCall={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ovozli qo\'ng\'iroq' })).toBeNull();
  });
});

describe('SystemMessage', () => {
  it('qo\'ng\'iroq natijasini ko\'rsatadi', () => {
    const message = {
      id: 'm1', chatId: 'chat-1', senderId: 'me', senderName: 'Men', senderPhoto: null, content: '📞 Qo\'ng\'iroq, 3:12',
      type: 'system', status: 'sent', createdAt: Date.now(), updatedAt: Date.now(), editedAt: null,
    } satisfies Message;
    render(<SystemMessage message={message} />);
    expect(screen.getByRole('note')).toHaveTextContent('📞 Qo\'ng\'iroq, 3:12');
  });
});
