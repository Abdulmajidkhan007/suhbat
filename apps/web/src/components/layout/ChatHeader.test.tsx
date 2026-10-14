import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeChat } from '../../test/render';
import ChatHeader from './ChatHeader';

const props = { chat: makeChat(), currentUid: 'me', isOnline: false };

describe('ChatHeader', () => {
  it('kichik ekranda "Orqaga" tugmasi ro\'yxatga qaytaradi; keng ekranda tugma yo\'q', () => {
    const onBack = vi.fn();
    const { rerender } = render(<ChatHeader {...props} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }));
    expect(onBack).toHaveBeenCalledOnce();

    rerender(<ChatHeader {...props} />);
    expect(screen.queryByRole('button', { name: 'Orqaga' })).toBeNull();
  });

  it('holat o\'zbekcha: onlayn / oflayn / oxirgi marta', () => {
    const { rerender } = render(<ChatHeader {...props} isOnline />);
    expect(screen.getByText('onlayn')).toBeInTheDocument();

    rerender(<ChatHeader {...props} />);
    expect(screen.getByText('oflayn')).toBeInTheDocument();

    const seen = new Date(2020, 0, 5, 10, 0).getTime();
    const chat = makeChat({
      participantDetails: {
        me: makeChat().participantDetails.me,
        v:  { ...makeChat().participantDetails.v, lastSeen: seen },
      },
    });
    rerender(<ChatHeader {...props} chat={chat} />);
    expect(screen.getByText('05.01.2020 da bo\'lgan')).toBeInTheDocument();
  });
});
