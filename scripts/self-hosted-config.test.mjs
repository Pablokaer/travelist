// Run: node --test scripts/
// The self-hosted Supabase (D-082) is wired through three files that must agree: the Compose
// override publishes the gateway and database ports, Apache proxies the API paths to the gateway,
// and deploy-backend.sh tunnels to the database. Nothing else checks them before production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { repoRootOf } from './repo-root.mjs';

const root = repoRootOf(import.meta.url);
const read = (path) => readFileSync(join(root, path), 'utf8');
const compose = read('deploy/supabase/docker-compose.travelist.yml');
const apache = read('deploy/apache/travelist.live-le-ssl.conf');
const deployBackend = read('scripts/deploy-backend.sh');

/** Linux's default ip_local_port_range starts here (see /proc/sys/net/ipv4/ip_local_port_range). */
const FIRST_EPHEMERAL_PORT = 32768;

/** The host port Compose publishes for a container port, e.g. 18000 for 8000. */
function publishedPort(containerPort) {
  const match = new RegExp(`127\\.0\\.0\\.1:(\\d+):${containerPort}/tcp`).exec(compose);
  assert.ok(
    match,
    `docker-compose.travelist.yml publishes no 127.0.0.1:<port>:${containerPort}/tcp`,
  );
  return Number(match[1]);
}

test('published ports sit below the ephemeral range', () => {
  // Regression: 54321/54322 collided with Apache's own outgoing proxy connections.
  for (const port of [publishedPort(8000), publishedPort(5432)]) {
    assert.ok(port < FIRST_EPHEMERAL_PORT, `port ${port} is inside the ephemeral range`);
  }
});

test('Apache proxies every API path the Supabase client calls to the gateway', () => {
  const gateway = `http://127.0.0.1:${publishedPort(8000)}`;
  for (const path of ['rest', 'auth', 'storage', 'functions', 'realtime']) {
    assert.match(apache, new RegExp(`ProxyPass\\s+/${path}/v1/ ${gateway}/${path}/v1/`));
  }
  assert.match(apache, /ProxyPass\s+\/realtime\/v1\/ \S+ upgrade=websocket/);
});

test('API paths skip the static-export rewrites', () => {
  const skip = apache.indexOf('RewriteRule ^/(rest|auth|storage|functions|realtime|graphql)/v1');
  assert.ok(skip > 0, 'no RewriteRule passing the API paths through');
  assert.ok(skip < apache.indexOf('RewriteRule ^/$ /index.var'), 'the API skip must come first');
});

test('deploy-backend.sh tunnels to the published database port', () => {
  const dbPort = publishedPort(5432);
  assert.match(deployBackend, new RegExp(`127\\.0\\.0\\.1:${dbPort}"? travelist-vps`));
});
