import React from 'react';

/** Faqat http(s) havolalar (javascript:, data: va h.k. — hech qachon). */
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
/** Havola oxiridagi tinish belgilari (gap oxiri) havolaga kirmaydi. */
const TRAILING = /[.,;:!?)\]}'"»]+$/;

export type TextPart = { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

export const splitLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trail = raw.match(TRAILING)?.[0] ?? '';
    const url = raw.slice(0, raw.length - trail.length);
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'link', value: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
};

/** Matndagi havolalarni yangi oynada ochiladigan `<a>` ga aylantiradi (Electron'da — tizim brauzeri). */
export const Linkified: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <>
    {splitLinks(text).map((p, i) =>
      p.type === 'link' ? (
        <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className={className ?? 'underline break-all'}>
          {p.value}
        </a>
      ) : (
        <React.Fragment key={i}>{p.value}</React.Fragment>
      ),
    )}
  </>
);
