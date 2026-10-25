import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { App } from '../App';
import { CHAT_ID, PEER, directChat } from '../test/fixtures';
import { createFakeServices } from '../test/fakeServices';

const CALL_ID = '9d3c2b1a-0f9e-4d8c-b7a6-5f4e3d2c1b0a';

const signedIn = () =>
  createFakeServices({ hasSession: jest.fn(async () => true), listChats: jest.fn(async () => [directChat()]) });

describe('Qo\'ng\'iroqlar (mobil UI)', () => {
  it('kiruvchi: ekran, jiringlash signali, qabul → ulanmoqda → tugatish', async () => {
    const fake = signedIn();
    await render(<App services={fake.services} />);
    await screen.findByText(PEER.displayName);

    await act(() => fake.emit('call:invite', {
      callId: CALL_ID, chatId: CHAT_ID, media: 'video', from: PEER, createdAt: new Date().toISOString(),
    }));
    expect(screen.getByText('Kiruvchi video qo\'ng\'iroq')).toBeTruthy();
    expect(fake.signaling.callRinging).toHaveBeenCalledWith(CALL_ID);
    expect(fake.inCall.startRingtone).toHaveBeenCalledTimes(1); // jiringlash

    await fireEvent.press(screen.getByLabelText('Qabul qilish'));
    await waitFor(() => expect(fake.signaling.acceptCall).toHaveBeenCalledWith(CALL_ID));
    expect(fake.media.getLocalStream).toHaveBeenCalledWith('video');
    expect(screen.getByText('Ulanmoqda…')).toBeTruthy();
    expect(screen.getAllByTestId('rtc-view')).toHaveLength(1); // o'z kamerasi (PiP)
    expect(fake.inCall.stopRingtone).toHaveBeenCalledTimes(1);
    expect(fake.inCall.start).toHaveBeenCalledWith({ media: 'video' });

    // Video: karnay boshida yoqiq; almashtirish native'ga boradi
    await fireEvent.press(screen.getByLabelText('Karnayni o\'chirish'));
    expect(fake.inCall.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(false);
    expect(screen.getByLabelText('Karnayni yoqish')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Mikrofonni o\'chirish'));
    expect(fake.media.setAudioEnabled).toHaveBeenCalledWith(expect.anything(), false);
    expect(screen.getByLabelText('Mikrofonni yoqish')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Tugatish'));
    expect(fake.signaling.endCall).toHaveBeenCalledWith(CALL_ID);
    expect(screen.getByText('Qo\'ng\'iroq tugadi')).toBeTruthy();
    expect(fake.inCall.stop).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Qo\'ng\'iroq tugadi')).toBeNull()); // biroz turib yopiladi
  });

  it('kiruvchi bekor qilinsa — ekran yopiladi; rad etish', async () => {
    const fake = signedIn();
    await render(<App services={fake.services} />);
    await screen.findByText(PEER.displayName);
    const invite = { callId: CALL_ID, chatId: CHAT_ID, media: 'audio' as const, from: PEER, createdAt: new Date().toISOString() };

    await act(() => fake.emit('call:invite', invite));
    await act(() => fake.emit('call:end', { callId: CALL_ID, reason: 'cancelled', durationMs: null }));
    expect(screen.queryByText('Kiruvchi qo\'ng\'iroq')).toBeNull();

    await waitFor(() => expect(fake.calls.getState()).toBeNull());
    await act(() => fake.emit('call:invite', { ...invite, callId: '1d3c2b1a-0f9e-4d8c-b7a6-5f4e3d2c1b0a' }));
    await fireEvent.press(screen.getByLabelText('Rad etish'));
    expect(fake.signaling.rejectCall).toHaveBeenCalledWith('1d3c2b1a-0f9e-4d8c-b7a6-5f4e3d2c1b0a');
  });

  it('chat sarlavhasidan ovozli qo\'ng\'iroq; band javobi', async () => {
    const fake = signedIn();
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText(PEER.displayName));
    await fireEvent.press(await screen.findByLabelText('Ovozli qo\'ng\'iroq'));

    await waitFor(() => expect(fake.signaling.inviteCall).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: CHAT_ID, media: 'audio' }),
    ));
    expect(screen.getByText('Qo\'ng\'iroq qilinmoqda…')).toBeTruthy();
    const callId = (fake.signaling.inviteCall.mock.calls[0]?.[0] as { callId: string }).callId;
    await act(() => fake.emit('call:ringing', { callId }));
    expect(screen.getByText('Jiringlamoqda…')).toBeTruthy();
    await act(() => fake.emit('call:busy', { callId }));
    expect(screen.getByText('Band')).toBeTruthy();
  });

  it('tizim xabari chatda markazda ko\'rinadi', async () => {
    const fake = createFakeServices({
      hasSession:   jest.fn(async () => true),
      listChats:    jest.fn(async () => [directChat()]),
      listMessages: jest.fn(async () => ({
        items: [{
          id: '5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d', chatId: CHAT_ID, senderId: PEER.id, type: 'system' as const,
          content: '📞 Javobsiz qo\'ng\'iroq', attachment: null, createdAt: new Date().toISOString(), editedAt: null,
        }],
        nextCursor: null,
      })),
    });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText(PEER.displayName));
    expect(await screen.findByText(/📞 Javobsiz qo'ng'iroq · /)).toBeTruthy();
  });
});
