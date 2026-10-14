import React, { useEffect, useRef } from 'react';

interface Props {
  stream:     MediaStream;
  /** `audio` — faqat ovoz (ko'rinmaydi); `video` — video element. */
  kind:       'audio' | 'video';
  /** O'z kameramiz: ovozsiz va ko'zgu kabi. */
  local?:     boolean;
  className?: string;
  label?:     string;
}

/** `MediaStream` ni `<video>`/`<audio>` ga ulaydi (`srcObject` faqat ref orqali beriladi). */
const MediaView: React.FC<Props> = ({ stream, kind, local = false, className, label }) => {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    // Avtomatik ijro rad etilsa (brauzer siyosati) — jim; foydalanuvchi tugmani bosganda qayta urinamiz.
    el.play?.()?.catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  if (kind === 'audio') return <audio ref={ref} autoPlay aria-label={label} />;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={local}
      aria-label={label}
      className={className}
      style={local ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
};

export default MediaView;
