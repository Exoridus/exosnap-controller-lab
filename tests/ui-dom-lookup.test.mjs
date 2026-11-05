import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The app's $() helper uses document.getElementById(), not querySelector().
// A CSS class passed to it causes a null dereference when connecting WebHID.
test('every literal $() DOM lookup refers to an element ID in index.html', () => {
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const lookups = [...app.matchAll(/\$\(\s*["']([^"']+)["']\s*\)/g)]
    .map(match => match[1]);
  const invalid = [...new Set(lookups.filter(id => !ids.has(id)))];
  assert.deepEqual(invalid, [], 'Invalid getElementById lookups: ' + invalid.join(', '));
});
