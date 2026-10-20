// The client role in real Chromium (the confirm page's environment), with the
// issuer and gateway in Node. Uses the Chromium this environment preinstalls.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as r from '../roles.js';

const root = fileURLToPath(new URL('..', import.meta.url));
let browser, page;

before(async () => {
  const out = await build({
    entryPoints: [root + 'client-entry.js'], bundle: true, format: 'iife', platform: 'browser',
    write: false, logLevel: 'warning',
  });
  const script = out.outputFiles[0].text;
  const executablePath = process.env.PP_CHROMIUM || undefined;
  browser = await chromium.launch({ executablePath });
  page = await browser.newPage();
  // localhost is a secure context, which WebCrypto requires.
  await page.route('http://localhost/**', (route) => route.request().url().endsWith('.js')
    ? route.fulfill({ contentType: 'text/javascript', body: script })
    : route.fulfill({ contentType: 'text/html', body: '<!doctype html><script src="/client.js"></script>' }));
  await page.goto('http://localhost/');
});
after(() => browser?.close());

test('chromium: the confirm page can mint a token the gateway accepts', async () => {
  const keys = await r.importIssuerKeys(await r.generateIssuerKeys());
  const issuer = r.makeIssuer('issuer.test', keys);
  const origin = r.makeOrigin('gateway.test');
  const challenge = r.b64(r.challengeFor(origin, 'issuer.test'));
  const pk = r.b64(await r.getPublicKeyBytes(keys.publicKey));

  const t0 = Date.now();
  const reqB64 = await page.evaluate(([c, k]) => pp.request(c, k), [challenge, pk]);
  const t1 = Date.now();
  const resB64 = r.b64(await r.issue(issuer, r.unb64(reqB64)));
  const t2 = Date.now();
  const tokenB64 = await page.evaluate((x) => pp.finalize(x), resB64);
  const t3 = Date.now();
  console.log(`# chromium client: request ${t1 - t0} ms, finalize ${t3 - t2} ms`);

  const spent = new Set();
  const store = { has: async (n) => spent.has(n), add: async (n) => spent.add(n) };
  assert.deepEqual(await r.redeem(origin, 'issuer.test', keys.publicKey, r.unb64(tokenB64), store), { ok: true });
  assert.equal((await r.redeem(origin, 'issuer.test', keys.publicKey, r.unb64(tokenB64), store)).ok, false);
});
