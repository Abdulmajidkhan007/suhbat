import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../../types';
import MessageBubble from './MessageBubble';

const msg = (over: Partial<Message> = {}): Message => ({
  id: 'm1', chatId: 'c1', senderId: 'v', senderName: 'Vali', senderPhoto: null,
  content: 'salom https://suhbat.uz', type: 'text', status: 'sent',
  createdAt: Date.now(), updatedAt: Date.now(), editedAt: null, ...over,
});

describe('MessageBubble', () => {
  it('havola bosiladigan va xavfsiz (yangi oyna, noopener)', () => {
    render(<MessageBubble message={msg()} isSelf={false} />);
    const link = screen.getByRole('link', { name: 'https://suhbat.uz' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('1:1 da yuboruvchi ismi ko\'rsatilmaydi, guruhda ko\'rsatiladi', () => {
    const { rerender } = render(<MessageBubble message={msg()} isSelf={false} showSender={false} />);
    expect(screen.queryByText('Vali')).toBeNull();
    rerender(<MessageBubble message={msg()} isSelf={false} showSender />);
    expect(screen.getByText('Vali')).toBeInTheDocument();
  });

  it('begona xabar: "Nusxa olish" menyusi (tahrir/o\'chirish huquqisiz ham)', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<MessageBubble message={msg()} isSelf={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xabar amallari' }));
    expect(screen.queryByText('Tahrirlash')).toBeNull();
    fireEvent.click(screen.getByText('Nusxa olish'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('salom https://suhbat.uz'));
  });

  it('yuborilmagan xabar: "Yuborilmadi", qayta yuborish va o\'chirish', () => {
    const onResend = vi.fn();
    const onDiscard = vi.fn();
    render(
      <MessageBubble
        message={msg({ id: 'optimistic-1', senderId: 'me', status: 'failed', isOptimistic: true })}
        isSelf
        onResend={onResend}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getByText('Yuborilmadi')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'yuborilmadi' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Qayta yuborish' }));
    expect(onResend).toHaveBeenCalledWith('optimistic-1');
    fireEvent.click(screen.getByRole('button', { name: 'O\'chirish' }));
    expect(onDiscard).toHaveBeenCalledWith('optimistic-1');
  });
});

describe('MessageBubble — javob', () => {
  const reply = { id: '11111111-1111-4111-8111-111111111111', senderId: 'v', content: 'asl xabar', kind: null, deleted: false };

  it('javob bloki: muallif va matn; bosilsa asl xabarga o\'tish', () => {
    const onJump = vi.fn();
    render(<MessageBubble message={msg({ replyTo: reply })} isSelf={false} replyName="Vali" onJump={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: 'Javob: Vali: asl xabar' }));
    expect(onJump).toHaveBeenCalledWith(reply.id);
  });

  it('o\'chirilgan asl xabar — "O\'chirilgan xabar", bosib bo\'lmaydi', () => {
    const onJump = vi.fn();
    render(<MessageBubble message={msg({ replyTo: { ...reply, content: '', deleted: true } })} isSelf={false} replyName="Vali" onJump={onJump} />);
    const quote = screen.getByRole('button', { name: 'Javob: Vali: O\'chirilgan xabar' });
    expect(quote).toBeDisabled();
  });

  it('menyuda "Javob berish"', () => {
    const onReply = vi.fn();
    const m = msg();
    render(<MessageBubble message={m} isSelf={false} onReply={onReply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xabar amallari' }));
    fireEvent.click(screen.getByText('Javob berish'));
    expect(onReply).toHaveBeenCalledWith(m);
  });
});
