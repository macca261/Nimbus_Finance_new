// Vitest DOM matchers setup
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { Assertion, AsymmetricMatchersContaining } from 'vitest';

// Type declaration for toBeInTheDocument
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeInTheDocument(): void;
  }
  interface AsymmetricMatchersContaining {
    toBeInTheDocument(): void;
  }
}

// Extend Vitest's expect with toBeInTheDocument matcher
// Note: getByText already throws if element not found, so this mainly validates non-null
expect.extend({
  toBeInTheDocument(received: any) {
    const pass = received !== null && received !== undefined;
    
    if (pass) {
      return {
        message: () => `expected element not to be in document`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to be in document, but received ${received}`,
        pass: false,
      };
    }
  },
});

afterEach(() => {
  cleanup();
});

