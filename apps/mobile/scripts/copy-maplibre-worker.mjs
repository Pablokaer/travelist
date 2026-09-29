// maplibre-gl v6 loads its Web Worker from a separate ES module that Metro does not bundle.
// Copy the worker (and the chunk it imports) into public/ so Expo serves it at /maplibre/.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'));
const out = join(dirname(new URL(import.meta.url).pathname), '..', 'public', 'maplibre');
mkdirSync(out, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(dist, file), join(out, file));
}
