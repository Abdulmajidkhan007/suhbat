import { describe, expect, it, vi } from 'vitest';
import { TONE_URLS, createCallTonePlayer } from './callTones';
import type { ToneAudio } from './callTones';

const makeAudio = (play: () => Promise<void> = async () => undefined) => {
  const audio: ToneAudio & { plays: number } = {
    src: '', loop: false, currentTime: 5, plays: 0,
    play() { this.plays++; return play(); },
    pause: vi.fn(),
  };
  return audio;
};

describe('createCallTonePlayer', () => {
  it('ring/ringback: manba, takrorlash; bir xil ohang qayta boshlanmaydi; null — to\'xtaydi va boshiga qaytadi', async () => {
    const audios: ReturnType<typeof makeAudio>[] = [];
    const player = createCallTonePlayer({ createAudio: () => { const a = makeAudio(); audios.push(a); return a; } });
    player.set('ring');
    player.set('ring');
    expect(audios).toHaveLength(1);
    expect(audios[0]).toMatchObject({ src: TONE_URLS.ring, loop: true, plays: 1 });
    player.set('ringback');
    expect(audios[0]!.pause).toHaveBeenCalled();
    expect(audios[1]).toMatchObject({ src: TONE_URLS.ringback, loop: true });
    player.set(null);
    expect(audios[1]!.pause).toHaveBeenCalled();
    expect(audios[1]!.currentTime).toBe(0);
    expect(player.isBlocked()).toBe(false);
  });

  it('autoplay rad etilsa — xato yutilmaydi (report), blocked=true; keyingi bosishda qayta uriniladi va yangraydi', async () => {
    let allow = false;
    const audio = makeAudio(async () => { if (!allow) throw new DOMException('autoplay', 'NotAllowedError'); });
    const report = vi.fn();
    let gesture: (() => void) | null = null;
    const player = createCallTonePlayer({
      createAudio: () => audio,
      report,
      onGesture: (retry) => { gesture = retry; return () => { gesture = null; }; },
    });
    const seen: boolean[] = [];
    player.subscribe((b) => seen.push(b));

    player.set('ring');
    await vi.waitFor(() => expect(player.isBlocked()).toBe(true));
    expect(report).toHaveBeenCalledWith(expect.stringContaining('ring'), expect.objectContaining({ name: 'NotAllowedError' }));
    expect(gesture).not.toBeNull();

    allow = true;
    gesture!();
    await vi.waitFor(() => expect(player.isBlocked()).toBe(false));
    expect(audio.plays).toBe(2);
    expect(seen).toEqual([true, false]);
  });

  it('ohang bloklanganda to\'xtatilsa — kechikib kelgan rad holatni buzmaydi, gesture tinglovchi olib tashlanadi', async () => {
    let reject!: (e: unknown) => void;
    const audio = makeAudio(() => new Promise<void>((_, r) => { reject = r; }));
    let gesture: (() => void) | null = null;
    const report = vi.fn();
    const player = createCallTonePlayer({ createAudio: () => audio, report, onGesture: (retry) => { gesture = retry; return () => { gesture = null; }; } });
    player.set('ring');
    player.set(null);
    reject(new Error('kech'));
    await Promise.resolve();
    await Promise.resolve();
    expect(report).not.toHaveBeenCalled();
    expect(player.isBlocked()).toBe(false);
    expect(gesture).toBeNull();
  });

  it('play() sinxron xato bersa ham bloklangan deb belgilanadi', async () => {
    const audio = makeAudio(() => { throw new Error('NotSupportedError'); });
    const report = vi.fn();
    const player = createCallTonePlayer({ createAudio: () => audio, report, onGesture: () => () => undefined });
    player.set('ringback');
    await vi.waitFor(() => expect(player.isBlocked()).toBe(true));
    expect(report).toHaveBeenCalled();
  });
});
