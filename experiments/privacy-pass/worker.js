// The issuer and the blip gateway (origin) as one Worker, to see whether
// Privacy Pass runs in workerd off the shelf. Keys come from bindings the way
// a deployed Worker would get them from secrets.
import {
  importIssuerKeys, makeIssuer, makeOrigin, issue, redeem, challengeFor,
  clientRequest, clientFinalize, getPublicKeyBytes, b64,
} from './roles.js';

const ISSUER = 'issuer.test';
const ORIGIN = 'gateway.test';
const spentNonces = new Set(); // in production: a Durable Object
const spent = { has: async (n) => spentNonces.has(n), add: async (n) => spentNonces.add(n) };

let state;
async function load(env) {
  if (!state) {
    const keys = await importIssuerKeys({ pkcs8: env.ISSUER_PKCS8, spki: env.ISSUER_SPKI });
    state = { keys, issuer: makeIssuer(ISSUER, keys, { native: true }), slowIssuer: makeIssuer(ISSUER, keys), origin: makeOrigin(ORIGIN) };
  }
  return state;
}

const bytes = async (req) => new Uint8Array(await req.arrayBuffer());
const bin = (u8, status = 200) => new Response(u8, { status, headers: { 'content-type': 'application/octet-stream' } });

export default {
  async fetch(req, env) {
    const { keys, issuer, slowIssuer, origin } = await load(env);
    const { pathname } = new URL(req.url);
    if (pathname === '/key') return bin(await getPublicKeyBytes(keys.publicKey));
    if (pathname === '/challenge') return bin(challengeFor(origin, ISSUER));
    if (pathname === '/issue' && req.method === 'POST') return bin(await issue(issuer, await bytes(req)));
    if (pathname === '/redeem' && req.method === 'POST') {
      const r = await redeem(origin, ISSUER, keys.publicKey, await bytes(req), spent);
      return Response.json(r, { status: r.ok ? 200 : 403 });
    }
    // The client role inside workerd too: a stand-in for the confirm page,
    // since workerd and browsers share WebCrypto rather than Node's crypto.
    if (pathname === '/selftest') {
      const pk = await getPublicKeyBytes(keys.publicKey);
      const { client, requestBytes } = await clientRequest(challengeFor(origin, ISSUER), pk);
      const token = await clientFinalize(client, await issue(issuer, requestBytes));
      const first = await redeem(origin, ISSUER, keys.publicKey, token, spent);
      const second = await redeem(origin, ISSUER, keys.publicKey, token, spent);
      return Response.json({ first, second, tokenBytes: token.length, token: b64(token) });
    }
    // Issuance cost, native RSA-RAW vs the library's BigInt fallback. Deployed
    // Workers freeze timers during CPU work, so this only means something
    // under local workerd.
    if (pathname === '/bench') {
      const pk = await getPublicKeyBytes(keys.publicKey);
      const out = {};
      for (const [label, iss] of [['native', issuer], ['bigint', slowIssuer]]) {
        const { requestBytes } = await clientRequest(challengeFor(origin, ISSUER), pk);
        const t0 = performance.now();
        for (let i = 0; i < 5; i++) await issue(iss, requestBytes);
        out[label + 'MsPerIssue'] = (performance.now() - t0) / 5;
      }
      return Response.json(out);
    }
    return new Response('not found', { status: 404 });
  },
};
