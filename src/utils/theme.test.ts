import test from 'node:test';
import assert from 'node:assert/strict';

// Setup mock DOM and storage for Node test runner
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

if (typeof globalThis.document === 'undefined') {
  const classListSet = new Set<string>();
  const attributes = new Map<string, string>();
  globalThis.document = {
    documentElement: {
      setAttribute: (k: string, v: string) => attributes.set(k, v),
      getAttribute: (k: string) => attributes.get(k) ?? null,
      classList: {
        add: (c: string) => classListSet.add(c),
        remove: (c: string) => classListSet.delete(c),
        contains: (c: string) => classListSet.has(c),
      },
    },
  } as unknown as Document;
}

import { getEffectiveTheme, applyThemeToDom } from './theme';
import { storageService } from '../services/storageService';

test('getEffectiveTheme returns explicit light and dark themes accurately', () => {
  assert.equal(getEffectiveTheme('light'), 'light');
  assert.equal(getEffectiveTheme('dark'), 'dark');
});

test('storageService defaults to light theme mode and persists dark theme choice', () => {
  // Reset
  storageService.saveThemeMode('light');
  assert.equal(storageService.getThemeMode(), 'light');

  // Switch to Night Owl mode
  storageService.saveThemeMode('dark');
  assert.equal(storageService.getThemeMode(), 'dark');

  // Verify that clearing progress (e.g. on sign-out / reset) preserves device theme preference
  storageService.clearAllProgress();
  assert.equal(storageService.getThemeMode(), 'dark');

  // Restore light as default
  storageService.saveThemeMode('light');
  assert.equal(storageService.getThemeMode(), 'light');
});

test('applyThemeToDom sets data-theme attribute and toggles .dark class accurately', () => {
  const effectiveDark = applyThemeToDom('dark');
  assert.equal(effectiveDark, 'dark');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.ok(document.documentElement.classList.contains('dark'));

  const effectiveLight = applyThemeToDom('light');
  assert.equal(effectiveLight, 'light');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(document.documentElement.classList.contains('dark'), false);
});
