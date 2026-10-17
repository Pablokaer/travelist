// Run: node --test scripts/
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { repoRootOf } from './repo-root.mjs';

test('the root holds the repository package.json, on Windows too', () => {
  // URL.pathname gave '/D:/…' on Windows, which join() turned into 'D:\D:\…' (ENOENT).
  const packageJson = join(repoRootOf(import.meta.url), 'package.json');
  assert.ok(existsSync(packageJson), `expected a package.json at ${packageJson}`);
  assert.equal(JSON.parse(readFileSync(packageJson, 'utf8')).name, 'wayfarer');
});
