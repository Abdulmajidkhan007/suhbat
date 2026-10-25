import type { CallState } from '@suhbat/client';
import { createCallAudio } from './callAudio';
import type { InCallManagerLike } from './callAudio';


const state = (patch: Partial<CallState<unknown>>): CallState<unknown> => ({
  phase: 'idle', callId: 'c1', chatId: 'chat', media: 'audio', direction: 'outgoing', peer: null, remoteRinging: false,
  reconnecting: false, connectedAt: null, muted: false, cameraOff: false, localStream: null, remoteStream: null,
  endReason: null, error: null, ...patch,
}) ;

const makeManager = () => {
  const m = {
    start: jest.fn(), stop: jest.fn(), startRingtone: jest.fn(), stopRingtone: jest.fn(),
    stopRingback: jest.fn(), setForceSpeakerphoneOn: jest.fn(),
  } satisfies { [K in keyof InCallManagerLike]: jest.Mock };
  return m;
};

describe('createCallAudio', () => {
  it('kiruvchi: jiringlash boshlanadi (audio sessiya ochilmaydi); qabul qilinsa to\'xtab, qo\'ng\'iroq rejimi yoqiladi', () => {
    const m = makeManager();
    const audio = createCallAudio(m);
    const ringing = state({ phase: 'ringing', direction: 'incoming' });
    audio.sync(ringing);
    audio.sync(ringing); // takror — hech narsa
    expect(m.startRingtone).toHaveBeenCalledTimes(1);
    expect(m.startRingtone).toHaveBeenCalledWith('_DEFAULT_', expect.any(Array), 'default', 0);
    expect(m.start).not.toHaveBeenCalled();

    audio.sync(state({ phase: 'connecting', direction: 'incoming', media: 'audio' }));
    expect(m.stopRingtone).toHaveBeenCalledTimes(1);
    expect(m.start).toHaveBeenCalledWith({ media: 'audio' });
    expect(audio.isSpeakerOn()).toBe(false);

    audio.sync(state({ phase: 'ended', direction: 'incoming' }));
    expect(m.stop).toHaveBeenCalledTimes(1);
  });

  it('kiruvchi rad etildi/bekor qilindi: faqat jiringlash to\'xtaydi, audio sessiya ochilmagan edi — stop chaqirilmaydi', () => {
    const m = makeManager();
    const audio = createCallAudio(m);
    audio.sync(state({ phase: 'ringing', direction: 'incoming' }));
    audio.sync(state({ phase: 'ended', direction: 'incoming' }));
    expect(m.stopRingtone).toHaveBeenCalledTimes(1);
    expect(m.stop).not.toHaveBeenCalled();
    audio.sync(null);
    expect(m.stop).not.toHaveBeenCalled();
  });

  it('chiquvchi: kutish ovozi (ringback) bilan sessiya ochiladi; accept kelganda ringback to\'xtaydi, sessiya qayta ochilmaydi', () => {
    const m = makeManager();
    const audio = createCallAudio(m);
    audio.sync(state({ phase: 'calling', direction: 'outgoing', media: 'audio' }));
    expect(m.start).toHaveBeenCalledWith({ media: 'audio', ringback: '_DTMF_' });
    audio.sync(state({ phase: 'connecting', direction: 'outgoing' }));
    expect(m.stopRingback).toHaveBeenCalledTimes(1);
    expect(m.start).toHaveBeenCalledTimes(1);
    expect(m.stop).not.toHaveBeenCalled();
    audio.sync(state({ phase: 'connected', direction: 'outgoing' }));
    audio.sync(null);
    expect(m.stop).toHaveBeenCalledTimes(1);
  });

  it('chiquvchi kutish paytida bekor qilindi — ringback to\'xtaydi va sessiya yopiladi', () => {
    const m = makeManager();
    const audio = createCallAudio(m);
    audio.sync(state({ phase: 'calling', direction: 'outgoing' }));
    audio.sync(state({ phase: 'ended', direction: 'outgoing', endReason: 'busy' }));
    expect(m.stopRingback).toHaveBeenCalledTimes(1);
    expect(m.stop).toHaveBeenCalledTimes(1);
  });

  it('karnay: video — boshida yoqiq; setSpeaker faqat qo\'ng\'iroq davomida native chaqiradi va obunachilarga xabar beradi', () => {
    const m = makeManager();
    const audio = createCallAudio(m);
    const listener = jest.fn();
    audio.subscribe(listener);
    audio.setSpeaker(true); // qo'ng'iroq yo'q — e'tiborsiz
    expect(m.setForceSpeakerphoneOn).not.toHaveBeenCalled();

    audio.sync(state({ phase: 'connecting', direction: 'incoming', media: 'video' }));
    expect(audio.isSpeakerOn()).toBe(true);
    audio.setSpeaker(false);
    expect(m.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(false);
    expect(audio.isSpeakerOn()).toBe(false);
    audio.setSpeaker(true);
    expect(m.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(true);
    expect(listener).toHaveBeenCalled();

    audio.sync(null);
    expect(audio.isSpeakerOn()).toBe(false); // keyingi qo'ng'iroq o'z standartidan boshlanadi
  });

  it('native xato qo\'ng\'iroqni buzmaydi, lekin yutilmaydi (report)', () => {
    const m = makeManager();
    m.startRingtone.mockImplementation(() => { throw new Error('modul yo\'q'); });
    const report = jest.fn();
    const audio = createCallAudio(m, report);
    expect(() => audio.sync(state({ phase: 'ringing', direction: 'incoming' }))).not.toThrow();
    expect(report).toHaveBeenCalledWith(expect.stringContaining('startRingtone'), expect.any(Error));
  });
});
