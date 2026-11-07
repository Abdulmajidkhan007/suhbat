import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@suhbat/client';
import { App } from './App';
import { createFakeServices } from './test/fakeServices';
import { directChat, ME } from './test/fixtures';

const PENDING = { ...ME, mustChangePassword: true };

describe('majburiy parol almashtirish (admin vaqtinchalik parol bergan)', () => {
  it('kirgach faqat yangi parol ekrani; chatlar ochilmaydi, socket ulanmaydi; almashgach ilova ochiladi', async () => {
    const fake = createFakeServices({
      hasSession:     jest.fn(async () => true),
      me:             jest.fn(async () => PENDING),
      listChats:      jest.fn(async () => [directChat()]),
      changePassword: jest.fn()
        .mockRejectedValueOnce(new ApiError(400, 'x'))
        .mockResolvedValueOnce({ ...ME, mustChangePassword: false }),
    });
    await render(<App services={fake.services} />);

    expect(await screen.findByText('Yangi parol o\'rnating')).toBeTruthy();
    expect(screen.queryByText('Vali')).toBeNull();
    expect(fake.api.listChats).not.toHaveBeenCalled();
    expect(fake.socket.connect).not.toHaveBeenCalled();

    // Yaroqsiz kombinatsiya: tugma o'chiq
    await fireEvent.changeText(screen.getByLabelText('Vaqtinchalik parol'), 'abcd-efgh-jkmn-pqrs');
    await fireEvent.changeText(screen.getByLabelText('Yangi parol'), 'yangi-parol-1');
    await fireEvent.changeText(screen.getByLabelText('Parolni tasdiqlang'), 'boshqa');
    expect(screen.getByText('Parollar mos emas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Parolni saqlash' }).props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(screen.getByLabelText('Parolni tasdiqlang'), 'yangi-parol-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Parolni saqlash' }));
    expect(await screen.findByText('Vaqtinchalik parol noto\'g\'ri')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Parolni saqlash' }));
    await waitFor(() => expect(fake.api.changePassword).toHaveBeenLastCalledWith('abcd-efgh-jkmn-pqrs', 'yangi-parol-1'));
    expect(await screen.findByText('Vali')).toBeTruthy(); // chatlar ro'yxati
    expect(screen.queryByText('Yangi parol o\'rnating')).toBeNull();
  });

  it('"Chiqish" — hisobdan chiqadi', async () => {
    const fake = createFakeServices({ hasSession: jest.fn(async () => true), me: jest.fn(async () => PENDING) });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Chiqish' }));
    await waitFor(() => expect(fake.api.logout).toHaveBeenCalled());
  });
});
