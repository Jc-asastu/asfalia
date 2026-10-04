import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { I18nProvider, useI18n } from './i18n';

function LanguageLabel() {
  const { lang, t } = useI18n();
  return createElement('span', null, `${lang}:${t.network}`);
}

function renderWithStoredLanguage(stored: string | null): string {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => stored, setItem: () => undefined },
  });
  try {
    return renderToString(createElement(I18nProvider, null, createElement(LanguageLabel)));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('falls back to English for an unsupported stored language', () => {
  assert.equal(renderWithStoredLanguage('fr'), '<span>en:network</span>');
});

test('preserves a valid stored Spanish language', () => {
  assert.equal(renderWithStoredLanguage('es'), '<span>es:red</span>');
});
