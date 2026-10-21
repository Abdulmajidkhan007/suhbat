import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@suhbat/client';
import { renderWithStore } from '../test/render';

const mocks = vi.hoisted(() => ({
  login: vi.fn(), register: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), checkUsername: vi.fn(), logout: vi.fn(),
  recoverWithCode: vi.fn(),
}));
vi.mock('../services/api', () => ({ api: mocks }));

const { default: LoginPage } = await import('./LoginPage');
const { default: ForgotPasswordPage } = await import('./ForgotPasswordPage');
const { default: ResetPasswordPage } = await import('./ResetPasswordPage');
const { default: RecoverWithCodePage } = await import('./RecoverWithCodePage');
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// To'liq sahifalar (MUI + framer-motion + router): sekin CI runner'da birinchi render 5 s dan oshadi.
vi.setConfig({ testTimeout: 20_000 });

const LocationProbe = () => <div data-testid="location">{useLocation().pathname + useLocation().search}</div>;

const renderAt = (path: string, signedIn = false) =>
  renderWithStore(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/recover" element={<RecoverWithCodePage />} />
        <Route path="/" element={<div>Bosh sahifa</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
    signedIn ? {} : { auth: { user: null, loading: false, error: null, initialized: true } },
  );

const apiUser = { id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', email: 'a@b.uz', displayName: 'Ali', username: 'ali_v', photoUrl: null, bio: null, createdAt: '2026-10-01T10:00:00.000Z' };

describe('Kirish sahifasi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('"Email yoki username" bilan kiradi; "Parolni unutdim?" so\'rov sahifasiga olib boradi', async () => {
    mocks.login.mockResolvedValue(apiUser);
    renderAt('/login');
    fireEvent.change(screen.getByLabelText(/Email yoki username/), { target: { value: ' @Ali_V ' } });
    fireEvent.change(screen.getByLabelText(/^Parol/, { selector: 'input' }), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith({ login: '@Ali_V', password: 'parol1234' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  });

  it('401 — "Login yoki parol noto\'g\'ri"', async () => {
    mocks.login.mockRejectedValue(new ApiError(401, 'x'));
    renderAt('/login');
    fireEvent.change(screen.getByLabelText(/Email yoki username/), { target: { value: 'ali_v' } });
    fireEvent.change(screen.getByLabelText(/^Parol/, { selector: 'input' }), { target: { value: 'xato' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    expect(await screen.findByText('Login yoki parol noto\'g\'ri.')).toBeInTheDocument();
  });

  it('"Parolni unutdim?" havolasi', () => {
    renderAt('/login');
    fireEvent.click(screen.getByRole('link', { name: 'Parolni unutdim?' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/forgot-password');
    expect(screen.getByRole('heading', { name: 'Parolni tiklash' })).toBeInTheDocument();
  });

  it('ro\'yxatdan o\'tish: username jonli tekshiruv (format darhol, bandlik serverdan)', async () => {
    mocks.checkUsername.mockImplementation(async (u: string) =>
      ({ username: u, available: u !== 'band_user', reason: u === 'band_user' ? 'Bu username band' : null }));
    mocks.register.mockResolvedValue({ user: apiUser, recoveryCodes: [] });
    renderAt('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Ro\'yxatdan o\'tish' }));
    const field = screen.getByLabelText('Username');
    expect(screen.getByText(/Ixtiyoriy/)).toBeInTheDocument();

    fireEvent.change(field, { target: { value: '1ab' } });
    expect(screen.getByText(/kamida 5/)).toBeInTheDocument();
    expect(mocks.checkUsername).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'Band_User' } });
    expect(await screen.findByText('Bu username band')).toBeInTheDocument();
    expect(mocks.checkUsername).toHaveBeenLastCalledWith('band_user');

    fireEvent.change(field, { target: { value: '@Yangi_Ali' } });
    expect(await screen.findByText('Bo\'sh — olish mumkin')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Ism/), { target: { value: 'Ali' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'a@b.uz' } });
    fireEvent.change(screen.getByLabelText(/^Parol/, { selector: 'input' }), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Ro\'yxatdan o\'tish' })[0]);
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith({ email: 'a@b.uz', password: 'parol1234', displayName: 'Ali', username: 'yangi_ali' }));
  });
});

describe('Tiklash kodlari: ro\'yxatdan o\'tgach', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kodlar ko\'rsatiladi; "saqladim" belgilanmaguncha davom etib bo\'lmaydi', async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `AAAA-BBBB-CC${String(i).padStart(2, '0')}`);
    mocks.register.mockResolvedValue({ user: apiUser, recoveryCodes: codes });
    mocks.checkUsername.mockResolvedValue({ username: '', available: true, reason: null });
    const { store } = renderAt('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Ro\'yxatdan o\'tish' }));
    fireEvent.change(screen.getByLabelText(/^Ism/), { target: { value: 'Ali' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'a@b.uz' } });
    fireEvent.change(screen.getByLabelText(/^Parol/, { selector: 'input' }), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Ro\'yxatdan o\'tish' })[0]);

    expect(await screen.findByRole('heading', { name: 'Tiklash kodlari' })).toBeInTheDocument();
    for (const c of codes) expect(screen.getByText(c)).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    const next = screen.getByRole('button', { name: 'Davom etish' });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Kodlarni xavfsiz joyga saqladim'));
    fireEvent.click(next);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(store.getState().auth.recoveryCodes).toBeNull();
  });
});

describe('Tiklash kodi bilan sahifasi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('"Parolni unutdim" sahifasidan o\'tiladi; login + kod + yangi parol yuboriladi', async () => {
    mocks.recoverWithCode.mockResolvedValue(undefined);
    renderAt('/forgot-password');
    fireEvent.click(screen.getByRole('link', { name: 'Tiklash kodi bilan' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/recover');

    fireEvent.change(screen.getByLabelText(/Email yoki username/), { target: { value: ' ali_v ' } });
    fireEvent.change(screen.getByLabelText(/^Tiklash kodi/), { target: { value: 'abcd-efgh-jkmn' } });
    fireEvent.change(screen.getByLabelText(/^Yangi parol/), { target: { value: 'Yangi-Parol-77' } });
    fireEvent.change(screen.getByLabelText(/^Parolni tasdiqlang/), { target: { value: 'Yangi-Parol-77' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parolni tiklash' }));
    await waitFor(() => expect(mocks.recoverWithCode).toHaveBeenCalledWith('ali_v', 'abcd-efgh-jkmn', 'Yangi-Parol-77'));
    expect(await screen.findByText(/ishlatilgan kod endi yaroqsiz/)).toBeInTheDocument();
  });

  it('noto\'g\'ri formatdagi kod — so\'rov ketmaydi; server 400 — umumiy xabar', async () => {
    renderAt('/recover');
    fireEvent.change(screen.getByLabelText(/Email yoki username/), { target: { value: 'ali_v' } });
    fireEvent.change(screen.getByLabelText(/^Tiklash kodi/), { target: { value: '123' } });
    expect(screen.getByText('12 belgi: harf va raqamlar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Parolni tiklash' }));
    expect(mocks.recoverWithCode).not.toHaveBeenCalled();

    mocks.recoverWithCode.mockRejectedValue(new ApiError(400, 'x'));
    fireEvent.change(screen.getByLabelText(/^Tiklash kodi/), { target: { value: 'AAAA-BBBB-CCCC' } });
    fireEvent.change(screen.getByLabelText(/^Yangi parol/), { target: { value: 'parol12345' } });
    fireEvent.change(screen.getByLabelText(/^Parolni tasdiqlang/), { target: { value: 'parol12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parolni tiklash' }));
    expect(await screen.findByText(/Login yoki tiklash kodi noto'g'ri/)).toBeInTheDocument();
  });

  it('email sozlanmagan (503) — "Kod bilan" yo\'li taklif qilinadi', async () => {
    mocks.forgotPassword.mockRejectedValue(new ApiError(503, 'x'));
    renderAt('/forgot-password');
    fireEvent.change(screen.getByLabelText(/Email yoki username/), { target: { value: 'a@b.uz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Havola yuborish' }));
    expect(await screen.findByRole('link', { name: 'Kod bilan' })).toHaveAttribute('href', '/recover');
  });
});

describe('Parolni unutdim sahifasi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('server javobini ko\'rsatadi (hisob bor-yo\'qligiga bog\'liq emas)', async () => {
    mocks.forgotPassword.mockResolvedValue({ message: 'Agar bunday hisob bo\'lsa, havola yuborildi.' });
    renderAt('/forgot-password');
    fireEvent.change(screen.getByLabelText(/Email yoki username/), { target: { value: ' ali_v ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Havola yuborish' }));
    expect(await screen.findByText('Agar bunday hisob bo\'lsa, havola yuborildi.')).toBeInTheDocument();
    expect(mocks.forgotPassword).toHaveBeenCalledWith('ali_v');
  });

  it('503 — email sozlanmagan', async () => {
    mocks.forgotPassword.mockRejectedValue(new ApiError(503, 'Email yuborish hozircha sozlanmagan'));
    renderAt('/forgot-password');
    fireEvent.change(screen.getByLabelText(/Email yoki username/), { target: { value: 'a@b.uz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Havola yuborish' }));
    expect(await screen.findByText(/hozircha sozlanmagan/)).toBeInTheDocument();
  });

  it('bo\'sh maydon — so\'rov yuborilmaydi', () => {
    renderAt('/forgot-password');
    fireEvent.click(screen.getByRole('button', { name: 'Havola yuborish' }));
    expect(screen.getByText('Email yoki username kiriting.')).toBeInTheDocument();
    expect(mocks.forgotPassword).not.toHaveBeenCalled();
  });
});

describe('Yangi parol sahifasi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('token URL\'dan darhol olib tashlanadi, lekin so\'rovda ishlatiladi', async () => {
    mocks.resetPassword.mockResolvedValue(undefined);
    renderAt('/reset-password?token=TOKEN_abc-123');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/reset-password$/));

    fireEvent.change(screen.getByLabelText(/^Yangi parol/), { target: { value: 'Yangi-Parol-77' } });
    expect(screen.getByText('Kuchli')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Parolni tasdiqlang/), { target: { value: 'Yangi-Parol-77' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));
    await waitFor(() => expect(mocks.resetPassword).toHaveBeenCalledWith('TOKEN_abc-123', 'Yangi-Parol-77'));
    expect(await screen.findByText(/barcha qurilmalardagi sessiyalar yopildi/)).toBeInTheDocument();
  });

  it('kuch ko\'rsatkichi va mos kelmagan tasdiq', () => {
    renderAt('/reset-password?token=t');
    fireEvent.change(screen.getByLabelText(/^Yangi parol/), { target: { value: 'abc' } });
    expect(screen.getByText('Juda qisqa')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Yangi parol/), { target: { value: 'abcdefgh' } });
    expect(screen.getByText('Zaif')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Parolni tasdiqlang/), { target: { value: 'abcdefgX' } });
    expect(screen.getByText('Parollar mos emas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('yaroqsiz/muddati o\'tgan havola — 400 xabari va yangi havola so\'rash', async () => {
    mocks.resetPassword.mockRejectedValue(new ApiError(400, 'x'));
    renderAt('/reset-password?token=eski');
    fireEvent.change(screen.getByLabelText(/^Yangi parol/), { target: { value: 'parol12345' } });
    fireEvent.change(screen.getByLabelText(/^Parolni tasdiqlang/), { target: { value: 'parol12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));
    expect(await screen.findByText(/Havola yaroqsiz yoki muddati o'tgan/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'So\'rash' })).toHaveAttribute('href', '/forgot-password');
  });

  it('tokensiz ochilsa — yangi havola so\'rash taklifi', () => {
    renderAt('/reset-password');
    expect(screen.getByText(/Havola to'liq emas/)).toBeInTheDocument();
  });

  it('kirgan foydalanuvchi parolni tiklasa — shu brauzerdan ham chiqadi', async () => {
    mocks.resetPassword.mockResolvedValue(undefined);
    mocks.logout.mockResolvedValue(undefined);
    const { store } = renderAt('/reset-password?token=t', true);
    fireEvent.change(screen.getByLabelText(/^Yangi parol/), { target: { value: 'parol12345' } });
    fireEvent.change(screen.getByLabelText(/^Parolni tasdiqlang/), { target: { value: 'parol12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));
    await waitFor(() => expect(store.getState().auth.user).toBeNull());
    expect(mocks.logout).toHaveBeenCalled();
  });
});
