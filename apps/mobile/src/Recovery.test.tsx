import Clipboard from '@react-native-clipboard/clipboard';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@suhbat/client';
import { App } from './App';
import { createFakeServices } from './test/fakeServices';
import { directChat, ME } from './test/fixtures';

const CODES = Array.from({ length: 10 }, (_, i) => `AAAA-BBBB-CC${String(i).padStart(2, '0')}`);

describe('Tiklash kodlari (emailsiz parol tiklash)', () => {
  it('ro\'yxatdan o\'tgach kodlar ko\'rsatiladi; nusxa olinadi; "saqladim"siz davom etib bo\'lmaydi', async () => {
    const fake = createFakeServices({
      register:      jest.fn(async () => ({ user: ME, recoveryCodes: CODES })),
      checkUsername: jest.fn(async (u: string) => ({ username: u, available: true, reason: null })),
      listChats:     jest.fn(async () => [directChat()]),
    });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText('Hisobingiz yo\'qmi? Ro\'yxatdan o\'ting'));
    await fireEvent.changeText(screen.getByLabelText('Ism'), 'Ali');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.uz');
    await fireEvent.changeText(screen.getByLabelText('Parol'), 'parol1234');
    await fireEvent.press(screen.getByText('Ro\'yxatdan o\'tish'));

    expect(await screen.findByText('Tiklash kodlari')).toBeTruthy();
    for (const c of CODES) expect(screen.getByText(c)).toBeTruthy();
    await fireEvent.press(screen.getByText('Nusxa olish'));
    expect(Clipboard.setString).toHaveBeenCalledWith(CODES.join('\n'));

    const next = screen.getByRole('button', { name: 'Davom etish' });
    expect(next.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent(screen.getByLabelText('Kodlarni xavfsiz joyga saqladim'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Davom etish' }));
    expect(await screen.findByText('Vali')).toBeTruthy(); // chatlar ro'yxati
    expect(screen.queryByText(CODES[0]!)).toBeNull();
  });

  it('"Parolni unutdim?" → "Tiklash kodi bilan" → login + kod + yangi parol', async () => {
    const fake = createFakeServices();
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Email yoki username'), 'ali_v');
    await fireEvent.press(screen.getByText('Parolni unutdim?'));
    await fireEvent.press(screen.getByText('Tiklash kodi bilan'));
    expect(screen.getByLabelText('Email yoki username').props.value).toBe('ali_v');

    await fireEvent.changeText(screen.getByLabelText('Tiklash kodi'), '123');
    await fireEvent.press(screen.getByText('Parolni tiklash'));
    expect(screen.getByText(/XXXX-XXXX-XXXX/, { exact: false })).toBeTruthy();
    expect(fake.api.recoverWithCode).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Tiklash kodi'), 'abcd-efgh-jkmn');
    await fireEvent.changeText(screen.getByLabelText('Yangi parol'), 'yangi-parol-1');
    await fireEvent.changeText(screen.getByLabelText('Parolni tasdiqlang'), 'yangi-parol-1');
    await fireEvent.press(screen.getByText('Parolni tiklash'));
    await waitFor(() => expect(fake.api.recoverWithCode).toHaveBeenCalledWith('ali_v', 'abcd-efgh-jkmn', 'yangi-parol-1'));
    expect(await screen.findByText(/ishlatilgan kod endi yaroqsiz/)).toBeTruthy();
  });

  it('noto\'g\'ri kod (400) — umumiy xabar', async () => {
    const fake = createFakeServices({ recoverWithCode: jest.fn(async () => { throw new ApiError(400, 'x'); }) });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText('Parolni unutdim?'));
    await fireEvent.press(screen.getByText('Tiklash kodi bilan'));
    await fireEvent.changeText(screen.getByLabelText('Email yoki username'), 'ali_v');
    await fireEvent.changeText(screen.getByLabelText('Tiklash kodi'), 'AAAA-BBBB-CCCC');
    await fireEvent.changeText(screen.getByLabelText('Yangi parol'), 'yangi-parol-1');
    await fireEvent.changeText(screen.getByLabelText('Parolni tasdiqlang'), 'yangi-parol-1');
    await fireEvent.press(screen.getByText('Parolni tiklash'));
    expect(await screen.findByText(/Login yoki tiklash kodi noto'g'ri/)).toBeTruthy();
  });

  it('Sozlamalar → Xavfsizlik: kodsiz hisobga taklif; joriy parol bilan yangi kodlar; parolni o\'zgartirish', async () => {
    const fake = createFakeServices({
      hasSession:              jest.fn(async () => true),
      listChats:               jest.fn(async () => [directChat()]),
      getRecoveryCodesStatus:  jest.fn(async () => ({ remaining: 0, generatedAt: null })),
      regenerateRecoveryCodes: jest.fn(async () => CODES),
      changePassword:          jest.fn()
        .mockRejectedValueOnce(new ApiError(400, 'x'))
        .mockResolvedValueOnce(ME),
    });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Sozlamalar' }));
    expect(await screen.findByText('Tiklash kodlari yo\'q — yarating')).toBeTruthy();
    await fireEvent.press(screen.getByText('Xavfsizlik'));
    expect(await screen.findByText(/Hali yaratilmagan/)).toBeTruthy();

    const [codesPassword] = screen.getAllByLabelText('Joriy parol');
    await fireEvent.changeText(codesPassword!, 'parol1234');
    await fireEvent.press(screen.getByText('Yangi kodlar yaratish'));
    await waitFor(() => expect(fake.api.regenerateRecoveryCodes).toHaveBeenCalledWith('parol1234'));
    expect(await screen.findByText(CODES[3]!)).toBeTruthy();
    await fireEvent(screen.getByLabelText('Kodlarni xavfsiz joyga saqladim'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Tayyor' }));
    expect(screen.queryByText(CODES[3]!)).toBeNull();

    const passwords = screen.getAllByLabelText('Joriy parol');
    await fireEvent.changeText(passwords[passwords.length - 1]!, 'xato');
    await fireEvent.changeText(screen.getByLabelText('Yangi parol'), 'yangi-parol-1');
    await fireEvent.changeText(screen.getByLabelText('Parolni tasdiqlang'), 'yangi-parol-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Parolni o\'zgartirish' }));
    expect(await screen.findByText('Joriy parol noto\'g\'ri')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Parolni o\'zgartirish' }));
    expect(await screen.findByText(/Parol o'zgardi/)).toBeTruthy();
    expect(fake.api.changePassword).toHaveBeenLastCalledWith('xato', 'yangi-parol-1');
  });
});
