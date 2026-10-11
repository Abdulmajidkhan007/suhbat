import { ApiError } from '@suhbat/client';
import { describe, expect, it } from 'vitest';
import { errorText } from './errors';

describe('errorText', () => {
  it('4xx — server matni, tarmoq xatosi — o\'z matni, qolgani — zaxira', () => {
    expect(errorText(new ApiError(403, 'Faqat egasi chatni o\'chira oladi'), 'zaxira')).toBe('Faqat egasi chatni o\'chira oladi');
    expect(errorText(new ApiError(0, 'Tarmoq xatosi.'), 'zaxira')).toBe('Tarmoq xatosi.');
    expect(errorText(new ApiError(500, 'ichki'), 'zaxira')).toBe('zaxira');
    expect(errorText(new ApiError(404, 'HTTP 404'), 'zaxira')).toBe('zaxira');
    expect(errorText(new Error('x'), 'zaxira')).toBe('zaxira');
  });
});
