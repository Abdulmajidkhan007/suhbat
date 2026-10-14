import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// `globals: false` — Testing Library o'zi tozalamaydi.
afterEach(cleanup);
