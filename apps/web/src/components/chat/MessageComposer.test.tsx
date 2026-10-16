import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MessageComposer from './MessageComposer';

const base = { onSend: vi.fn(), onTyping: vi.fn(), onAttach: vi.fn(), onVoice: vi.fn(), onError: vi.fn() };

describe('MessageComposer — javob paneli', () => {
  it('panel ko\'rinadi; ✕ va Escape bekor qiladi; Enter yuboradi', () => {
    const onCancelReply = vi.fn();
    const onSend = vi.fn();
    render(<MessageComposer {...base} onSend={onSend} replying={{ name: 'Vali', text: 'salom' }} onCancelReply={onCancelReply} />);
    expect(screen.getByText('Javob: Vali')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Javobni bekor qilish' }));
    expect(onCancelReply).toHaveBeenCalledTimes(1);

    const box = screen.getByPlaceholderText('Xabar yozing…');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(onCancelReply).toHaveBeenCalledTimes(2);
    fireEvent.change(box, { target: { value: 'ha' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('ha');
  });
});
