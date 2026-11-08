import { fireEvent, render, screen } from '@testing-library/react-native';
import { App } from './App';
import { createFakeServices } from './test/fakeServices';
import { directChat } from './test/fixtures';

describe('Maxfiylik ekrani', () => {
  it('Sozlamalar → Maxfiylik: serverdagi muddat, xabar matni o\'qilmasligi', async () => {
    const fake = createFakeServices({
      hasSession:     jest.fn(async () => true),
      listChats:      jest.fn(async () => [directChat()]),
      getPrivacyInfo: jest.fn(async () => ({ retentionDays: 45 })),
    });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Sozlamalar' }));
    await fireEvent.press(screen.getByText('Maxfiylik'));
    expect(await screen.findByText(/45 kun saqlanadi/)).toBeTruthy();
    expect(screen.getByText('Nima o\'qilmaydi')).toBeTruthy();
    expect(screen.getByText(/xabarlarining MATNI administratorga ko'rinmaydi/, { exact: false })).toBeTruthy();
  });

  it('server javob bermasa — standart muddat va ogohlantirish', async () => {
    const fake = createFakeServices({
      hasSession:     jest.fn(async () => true),
      listChats:      jest.fn(async () => [directChat()]),
      getPrivacyInfo: jest.fn(async () => { throw new Error('x'); }),
    });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Sozlamalar' }));
    await fireEvent.press(screen.getByText('Maxfiylik'));
    expect(await screen.findByText(/olib bo'lmadi/)).toBeTruthy();
    expect(screen.getByText(/90 kun saqlanadi/)).toBeTruthy();
  });
});
