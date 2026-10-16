import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@suhbat/client';
import { App } from './App';
import { createFakeServices } from './test/fakeServices';
import { ME } from './test/fixtures';

// Debounce (400 ms) haqiqiy taymer bilan kutiladi.
const SLOW = { timeout: 3000 };

describe('Kirish: username va parolni tiklash', () => {
  it('username bilan kirish', async () => {
    const fake = createFakeServices();
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Email yoki username'), '@Ali_V');
    await fireEvent.changeText(screen.getByLabelText('Parol'), 'parol1234');
    await fireEvent.press(screen.getByText('Kirish'));
    await waitFor(() => expect(fake.api.login).toHaveBeenCalledWith({ login: '@Ali_V', password: 'parol1234' }));
  });

  it('"Parolni unutdim?" → so\'rov ekrani → server javobi; orqaga', async () => {
    const fake = createFakeServices();
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Email yoki username'), 'ali_v');
    await fireEvent.press(screen.getByText('Parolni unutdim?'));
    expect(screen.getByText('Parolni tiklash')).toBeTruthy();
    expect(screen.getByLabelText('Email yoki username').props.value).toBe('ali_v'); // kiritilgani ko'chadi
    await fireEvent.press(screen.getByText('Havola yuborish'));
    expect(await screen.findByText('Agar bunday hisob bo\'lsa, havola yuborildi.')).toBeTruthy();
    expect(fake.api.forgotPassword).toHaveBeenCalledWith('ali_v');
    await fireEvent.press(screen.getByText('Kirish sahifasiga qaytish'));
    expect(screen.getByText('Hisobingizga kiring')).toBeTruthy();
  });

  it('so\'rov: 503 — tushunarli xabar', async () => {
    const fake = createFakeServices({ forgotPassword: jest.fn(async () => { throw new ApiError(503, 'x'); }) });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText('Parolni unutdim?'));
    await fireEvent.changeText(screen.getByLabelText('Email yoki username'), 'a@b.uz');
    await fireEvent.press(screen.getByText('Havola yuborish'));
    expect(await screen.findByText(/hozircha sozlanmagan/)).toBeTruthy();
  });

  describe('ro\'yxatdan o\'tish: username jonli tekshiruv', () => {
    it('format darhol, bandlik debounce bilan; bo\'sh username yuboriladi', async () => {
      const fake = createFakeServices({
        checkUsername: jest.fn(async (u: string) => ({ username: u, available: u !== 'band_user', reason: u === 'band_user' ? 'Bu username band' : null })),
      });
      await render(<App services={fake.services} />);
      await fireEvent.press(await screen.findByText('Hisobingiz yo\'qmi? Ro\'yxatdan o\'ting'));
      await fireEvent.changeText(screen.getByLabelText('Username'), 'ab');
      expect(screen.getByText(/kamida 5/)).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Username'), 'Band_User');
      expect(await screen.findByText('Bu username band', {}, SLOW)).toBeTruthy();
      expect(fake.api.checkUsername).toHaveBeenCalledWith('band_user');

      await fireEvent.changeText(screen.getByLabelText('Ism'), 'Ali');
      await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.uz');
      await fireEvent.changeText(screen.getByLabelText('Parol'), 'parol1234');
      await fireEvent.press(screen.getByText('Ro\'yxatdan o\'tish'));
      expect(fake.api.register).not.toHaveBeenCalled();

      await fireEvent.changeText(screen.getByLabelText('Username'), '@Yangi_Ali');
      expect(await screen.findByText('Bo\'sh — olish mumkin', {}, SLOW)).toBeTruthy();
      await fireEvent.press(screen.getByText('Ro\'yxatdan o\'tish'));
      await waitFor(() => expect(fake.api.register).toHaveBeenCalledWith({
        email: 'a@b.uz', password: 'parol1234', displayName: 'Ali', username: 'yangi_ali',
      }));
    });
  });
});

describe('Profil: username', () => {
  it('username o\'rnatish; band (409) bo\'lsa server xabari', async () => {
    const updateProfile = jest.fn()
      .mockRejectedValueOnce(new ApiError(409, 'Bu username band'))
      .mockResolvedValueOnce({ ...ME, username: 'ali_yangi' });
    const fake = createFakeServices({ hasSession: jest.fn(async () => true), updateProfile });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText('Profil'));
    await fireEvent.changeText(screen.getByLabelText('Username'), 'Ali_Yangi');
    expect(await screen.findByText('Bo\'sh — olish mumkin', {}, SLOW)).toBeTruthy();
    await fireEvent.press(screen.getByText('Saqlash'));
    expect(await screen.findByText('Bu username band', {}, SLOW)).toBeTruthy();
    await fireEvent.press(screen.getByText('Saqlash'));
    await waitFor(() => expect(updateProfile).toHaveBeenLastCalledWith({ displayName: ME.displayName, bio: '', username: 'ali_yangi' }));
    expect(await screen.findByText('Joriy username')).toBeTruthy();
  });
});
