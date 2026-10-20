// Privacy Pass for blips, in Node: does the issue → redeem flow hold up?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../roles.js';

const memorySpent = () => {
  const s = new Set();
  return { has: async (n) => s.has(n), add: async (n) => s.add(n) };
};

async function setup() {
  const keys = await r.importIssuerKeys(await r.generateIssuerKeys());
  const issuer = r.makeIssuer('issuer.test', keys);
  const origin = r.makeOrigin('gateway.test');
  const pk = await r.getPublicKeyBytes(keys.publicKey);
  const mint = async () => {
    const { client, requestBytes, blindedMsg } = await r.clientRequest(r.challengeFor(origin, 'issuer.test'), pk);
    const token = await r.clientFinalize(client, await r.issue(issuer, requestBytes));
    return { token, blindedMsg };
  };
  return { keys, origin, mint };
}

test('a token redeems once, then reads as spent', async () => {
  const { keys, origin, mint } = await setup();
  const spent = memorySpent();
  const { token } = await mint();
  assert.equal(token.length, 354);
  assert.deepEqual(await r.redeem(origin, 'issuer.test', keys.publicKey, token, spent), { ok: true });
  assert.deepEqual(await r.redeem(origin, 'issuer.test', keys.publicKey, token, spent), { ok: false, reason: 'already spent' });
});

test('a tampered token is refused', async () => {
  const { keys, origin, mint } = await setup();
  const { token } = await mint();
  token[token.length - 1] ^= 1;
  assert.equal((await r.redeem(origin, 'issuer.test', keys.publicKey, token, memorySpent())).ok, false);
});

test("another issuer's token is refused", async () => {
  const a = await setup();
  const b = await setup();
  const { token } = await b.mint();
  assert.deepEqual(await r.redeem(a.origin, 'issuer.test', a.keys.publicKey, token, memorySpent()), { ok: false, reason: 'bad signature' });
});

test('a token minted for one gateway is refused at another', async () => {
  const { keys, mint } = await setup(); // minted for gateway.test
  const { token } = await mint();
  const other = r.makeOrigin('other-gateway.test');
  assert.deepEqual(await r.redeem(other, 'issuer.test', keys.publicKey, token, memorySpent()),
    { ok: false, reason: 'minted for another gateway' });
});

test('garbage is refused, not thrown', async () => {
  const { keys, origin } = await setup();
  assert.equal((await r.redeem(origin, 'issuer.test', keys.publicKey, new Uint8Array(10), memorySpent())).ok, false);
});

// A sanity check, not a proof: the proof is RFC 9474's blindness property.
// What the issuer saw (the blinded message) shares nothing visible with what
// the gateway sees (nonce + signature).
test("the issuer's view and the gateway's view don't match up", async () => {
  const { mint } = await setup();
  const { token, blindedMsg } = await mint();
  const sig = token.slice(token.length - 256);
  assert.notDeepEqual(Buffer.from(sig), Buffer.from(blindedMsg));
  const hex = (u8) => Buffer.from(u8).toString('hex');
  for (let i = 0; i + 16 <= blindedMsg.length; i += 16) {
    assert.ok(!hex(token).includes(hex(blindedMsg.slice(i, i + 16))));
  }
});

test('a week of 10 tokens mints, each spendable once', async () => {
  const { keys, origin, mint } = await setup();
  const spent = memorySpent();
  const t0 = performance.now();
  const tokens = [];
  for (let i = 0; i < 10; i++) tokens.push((await mint()).token);
  const ms = performance.now() - t0;
  for (const t of tokens) assert.equal((await r.redeem(origin, 'issuer.test', keys.publicKey, t, spent)).ok, true);
  console.log(`# 10 tokens minted (client + issuer, Node) in ${ms.toFixed(0)} ms`);
});
