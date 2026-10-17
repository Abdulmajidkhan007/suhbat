import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { App } from '../../App';
import type { PrefsStorage } from '../../services/prefsStorage';
import { ACCENTS } from '../../theme/accents';
import { createFakeServices } from '../../test/fakeServices';
import { directChat } from '../../test/fixtures';

const memoryPrefs = (initial: Record<string, unknown> = {}) => {
  let data = { ...initial };
  const storage: PrefsStorage = {
    load: jest.fn(async () => data),
    save: jest.fn(async (next) => {
      data = { ...next };
    }),
  };
  return { storage, get: () => data };
};

const signedIn = (api: Parameters<typeof createFakeServices>[0] = {}) =>
  createFakeServices({ hasSession: jest.fn(async () => true), listChats: jest.fn(async () => [directChat()]), ...api });

const openSettings = async (fake = signedIn(), prefs = memoryPrefs()) => {
  await render(<App services={fake.services} prefs={prefs.storage} />);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Sozlamalar' }));
  return { fake, prefs };
};

describe('Sozlamalar', () => {
  it('versiya, profil kartasi, tablar orasida o\'tish', async () => {
    await openSettings();
    expect(screen.getByText(/^Suhbat v\d+\.\d+\.\d+/)).toBeTruthy();
    expect(screen.getByText('Ali Valiyev')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sozlamalar', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Suhbatlar' }));
    expect(await screen.findByText('Vali')).toBeTruthy();
  });

  it('ko\'rinish: qorong\'i rejim va asosiy rang tanlanadi, saqlanadi va qayta ochilganda tiklanadi', async () => {
    const { prefs } = await openSettings();
    await fireEvent.press(screen.getByText('Ko\'rinish'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Qorong\'i' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Yashil' }));
    expect(screen.getByRole('radio', { name: 'Yashil', selected: true })).toBeTruthy();
    expect(prefs.get()).toEqual({ mode: 'dark', accent: 'green' });

    // Tanlangan rang belgisi — qorong'i rejimdagi yashil.
    const swatch = screen.getByRole('radio', { name: 'Yashil' });
    expect(StyleSheet.flatten(swatch.props.style).backgroundColor).toBe(ACCENTS.green.dark);

    await screen.unmount();
    await render(<App services={signedIn().services} prefs={prefs.storage} />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Sozlamalar' }));
    expect(await screen.findByText('Qorong\'i · Yashil')).toBeTruthy();
  });

  it('bildirishnoma matni: o\'chirish serverga yuboriladi', async () => {
    const fake = signedIn({ updateNotificationSettings: jest.fn(async () => ({ preview: false })) });
    await openSettings(fake);
    await waitFor(() => expect(fake.api.getNotificationSettings).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText('Xabar matnini ko\'rsatish')).not.toBeDisabled());
    await fireEvent(screen.getByLabelText('Xabar matnini ko\'rsatish'), 'valueChange', false);
    await waitFor(() => expect(fake.api.updateNotificationSettings).toHaveBeenCalledWith({ preview: false }));
  });

  it('fonda ulanib turish (Android): yoqilsa batareya so\'rovi, cheklov qatori ko\'rinadi', async () => {
    const fake = signedIn();
    let enabled = false;
    const native = {
      ...fake.services.background.native,
      available:                         true,
      isIgnoringBatteryOptimizations:    jest.fn(async () => false),
      requestIgnoreBatteryOptimizations: jest.fn(),
    };
    Object.assign(fake.services.background, {
      available:  true,
      native,
      isEnabled:  jest.fn(async () => enabled),
      setEnabled: jest.fn(async (v: boolean) => { enabled = v; }),
    });
    await openSettings(fake);
    const toggle = await screen.findByLabelText('Fonda ulanib turish');
    await waitFor(() => expect(toggle).not.toBeDisabled());
    expect(screen.queryByText('Batareya cheklovini olib tashlash')).toBeNull();

    await fireEvent(toggle, 'valueChange', true);
    await waitFor(() => expect(fake.services.background.setEnabled).toHaveBeenCalledWith(true));
    await waitFor(() => expect(native.requestIgnoreBatteryOptimizations).toHaveBeenCalledTimes(1));
    await fireEvent.press(await screen.findByText('Batareya cheklovini olib tashlash'));
    expect(native.requestIgnoreBatteryOptimizations).toHaveBeenCalledTimes(2);
  });

  it('fon ulanishi faqat Android native bo\'lsa ko\'rinadi', async () => {
    await openSettings();
    expect(screen.queryByText('Fonda ulanib turish')).toBeNull();
  });

  it('mahalliy bildirishnoma bosilgan chat ochiladi', async () => {
    const fake = signedIn();
    let pending: string | null = directChat().id;
    Object.assign(fake.services.background, {
      available: true,
      native:    {
        ...fake.services.background.native,
        available:       true,
        consumeOpenChat: jest.fn(async () => { const id = pending; pending = null; return id; }),
      },
    });
    await render(<App services={fake.services} prefs={memoryPrefs().storage} />);
    await waitFor(() => expect(fake.api.listMessages).toHaveBeenCalled());
    expect(fake.services.background.native.consumeOpenChat).toHaveBeenCalled();
  });
});

