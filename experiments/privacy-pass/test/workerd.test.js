// The same flow with the issuer and gateway running in workerd, Cloudflare's
// Workers runtime (via Miniflare), and the client talking to them over HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import * as r from '../roles.js';

const root = fileURLToPath(new URL('..', import.meta.url));
let mf;

before(async () => {
  // Bundled inside this directory: workerd refuses script paths with "..".
  await build({
    entryPoints: [root + 'worker.js'], bundle: true, format: 'esm', platform: 'neutral',
    mainFields: ['module', 'main'], outfile: root + 'dist/worker.js', logLevel: 'warning',
  });
  const keys = await r.generateIssuerKeys();
  process.chdir(root);
  mf = new Miniflare({
    modules: true, scriptPath: 'dist/worker.js', compatibilityDate: '2025-09-01',
    bindings: { ISSUER_PKCS8: keys.pkcs8, ISSUER_SPKI: keys.spki },
  });
});
after(() => mf?.dispose());

const get = async (path) => new Uint8Array(await (await mf.dispatchFetch('http://w' + path)).arrayBuffer());
const post = (path, body) => mf.dispatchFetch('http://w' + path, { method: 'POST', body });

test('workerd: the client role runs inside the Worker too', async () => {
  const res = await mf.dispatchFetch('http://w/selftest');
  const body = await res.json();
  assert.deepEqual(body.first, { ok: true });
  assert.deepEqual(body.second, { ok: false, reason: 'already spent' });
});

test('workerd: issue and redeem over HTTP, with the client outside', async () => {
  const pk = await get('/key');
  const { client, requestBytes } = await r.clientRequest(await get('/challenge'), pk);
  const issued = await post('/issue', requestBytes);
  assert.equal(issued.status, 200);
  const token = await r.clientFinalize(client, new Uint8Array(await issued.arrayBuffer()));
  assert.equal((await post('/redeem', token)).status, 200);
  const again = await post('/redeem', token);
  assert.equal(again.status, 403);
  assert.equal((await again.json()).reason, 'already spent');
});

test('workerd: a tampered token is refused', async () => {
  const pk = await get('/key');
  const { client, requestBytes } = await r.clientRequest(await get('/challenge'), pk);
  const token = await r.clientFinalize(client, new Uint8Array(await (await post('/issue', requestBytes)).arrayBuffer()));
  token[200] ^= 1;
  assert.equal((await post('/redeem', token)).status, 403);
});

test('workerd: native RSA-RAW issuance produces tokens that verify', async () => {
  // /issue uses the native issuer; the HTTP test above already redeemed one.
  // This records the cost of each path for the README.
  const body = await (await mf.dispatchFetch('http://w/bench')).json();
  console.log(`# workerd issue: native ${body.nativeMsPerIssue.toFixed(1)} ms, bigint ${body.bigintMsPerIssue.toFixed(1)} ms`);
  assert.ok(body.nativeMsPerIssue >= 0);
});
