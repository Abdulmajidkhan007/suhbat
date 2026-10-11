import { BadRequestException } from '@nestjs/common';
import { RegisterInputSchema } from '@suhbat/core';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(RegisterInputSchema);

  it('to\'g\'ri body\'ni o\'zgartirib qaytaradi', () => {
    expect(pipe.transform({ email: 'A@B.UZ', password: '12345678', displayName: 'A' }).email).toBe('a@b.uz');
  });

  it('noto\'g\'ri body → 400', () => {
    expect(() => pipe.transform({ email: 'x' })).toThrow(BadRequestException);
  });
});
