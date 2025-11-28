import path from 'node:path';
import type { Category } from '@nimbus/shared/src/categories';

type SharedCategoriesModule = {
  getCategories?: () => Category[];
  CATEGORIES?: Category[];
};

let cached: Category[] | null = null;

function tryRequire(candidate: string): SharedCategoriesModule | null {
  try {
    if (candidate.endsWith('.ts')) {
      try {
        require('ts-node/register/transpile-only');
      } catch {
        // ts-node might not be installed in production builds; ignore.
      }
    }
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(candidate) as SharedCategoriesModule;
  } catch {
    return null;
  }
}

export function getSharedCategories(): Category[] {
  if (cached) return cached;

  const basePaths = [
    path.resolve(__dirname, '..', '..', '..', 'shared', 'dist', 'categories.js'),
    path.resolve(__dirname, '..', '..', '..', 'shared', 'dist', 'index.js'),
    path.resolve(__dirname, '..', '..', '..', 'shared', 'src', 'categories.ts'),
  ];

  for (const candidate of basePaths) {
    const mod = tryRequire(candidate);
    if (!mod) continue;
    const categories =
      (typeof mod.getCategories === 'function' ? mod.getCategories() : mod.CATEGORIES) ?? [];
    if (categories.length) {
      cached = categories;
      return cached;
    }
  }

  throw new Error(
    'Unable to load shared categories. Please run `npm run build` inside the shared package to generate dist files.'
  );
}


