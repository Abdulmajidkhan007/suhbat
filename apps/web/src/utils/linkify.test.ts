import { describe, expect, it } from 'vitest';
import { splitLinks } from './linkify';

describe('splitLinks', () => {
  it('http(s) havolalarni ajratadi, gap oxiridagi tinish belgisi havolaga kirmaydi', () => {
    expect(splitLinks('Qarang: https://suhbat.uz/a?b=1. Rahmat')).toEqual([
      { type: 'text', value: 'Qarang: ' },
      { type: 'link', value: 'https://suhbat.uz/a?b=1', href: 'https://suhbat.uz/a?b=1' },
      { type: 'text', value: '. Rahmat' },
    ]);
  });

  it('xavfli sxemalar havola bo\'lmaydi', () => {
    expect(splitLinks('javascript:alert(1) data:text/html,x ftp://x')).toEqual([
      { type: 'text', value: 'javascript:alert(1) data:text/html,x ftp://x' },
    ]);
  });

  it('havolasiz matn va bir nechta havola', () => {
    expect(splitLinks('salom')).toEqual([{ type: 'text', value: 'salom' }]);
    expect(splitLinks('http://a.uz va https://b.uz').filter((p) => p.type === 'link')).toHaveLength(2);
  });
});
