// The three Privacy Pass roles (RFC 9576), wired to @cloudflare/privacypass-ts.
// Publicly verifiable tokens, blind RSA (RFC 9578 type 0x0002).
//
// For blips: the *issuer* sits behind sign-in and hands out a weekly allowance;
// the *origin* is the blip gateway, which accepts one token per blip; the
// *client* is the confirm page in the person's browser.
import { publicVerif, Token, TokenChallenge } from '@cloudflare/privacypass-ts';

const { BLIND_RSA, BlindRSAMode, Issuer, Client, Origin, TokenRequest, TokenResponse, getPublicKeyBytes } = publicVerif;
export const MODE = BlindRSAMode.PSS;
export { BLIND_RSA, Token, TokenChallenge, getPublicKeyBytes };

const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export { b64, unb64 };

export async function generateIssuerKeys() {
  const { privateKey, publicKey } = await Issuer.generateKey(MODE, {
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
  });
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', publicKey));
  return { pkcs8: b64(pkcs8), spki: b64(spki) };
}

// How a deployed issuer would load its key: from a secret, not by generating it.
export async function importIssuerKeys({ pkcs8, spki }) {
  const params = BLIND_RSA.rsaParams;
  const privateKey = await crypto.subtle.importKey('pkcs8', unb64(pkcs8), params, true, ['sign']);
  const publicKey = await crypto.subtle.importKey('spki', unb64(spki), params, true, ['verify']);
  return { privateKey, publicKey };
}

// `native: true` uses workerd's non-standard RSA-RAW operation for the blind
// signature. It only exists in Workers; elsewhere the library does the RSA in
// BigInt JS, which is far slower (see README for numbers).
export function makeIssuer(name, { privateKey, publicKey }, { native = false } = {}) {
  return new Issuer(MODE, name, privateKey, publicKey, { supportsRSARAW: native });
}

export function makeOrigin(originName) {
  return new Origin(MODE, [originName]);
}

// Issuer side: bytes in, bytes out. This is all the issuer ever sees.
export async function issue(issuer, tokenRequestBytes) {
  const req = TokenRequest.deserialize(BLIND_RSA, tokenRequestBytes);
  const res = await issuer.issue(req);
  return res.serialize();
}

// Client side, in two steps around the network hop.
export async function clientRequest(challengeBytes, issuerPublicKeyBytes) {
  const client = new Client(MODE);
  const challenge = TokenChallenge.deserialize(challengeBytes);
  const req = await client.createTokenRequest(challenge, issuerPublicKeyBytes);
  return { client, requestBytes: req.serialize(), blindedMsg: req.blindedMsg };
}

export async function clientFinalize(client, responseBytes) {
  const token = await client.finalize(client.deserializeTokenResponse(responseBytes));
  return token.serialize();
}

// Origin side: check the token was minted for *this* gateway, verify the
// signature, then refuse a token already spent. `spent` is anything with
// has/add; in production it's a Durable Object.
//
// The binding check is ours: the library's verify() checks the signature
// only, so without it a token minted for one gateway redeems at any other
// gateway that trusts the same issuer (tested 2026-10-20).
export async function redeem(origin, issuerName, issuerPublicKey, tokenBytes, spent) {
  let token;
  try {
    token = Token.deserialize(BLIND_RSA, tokenBytes);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', challengeFor(origin, issuerName)));
  if (!equal(token.authInput.challengeDigest, expected)) return { ok: false, reason: 'minted for another gateway' };
  const valid = await origin.verify(token, issuerPublicKey).catch(() => false);
  if (!valid) return { ok: false, reason: 'bad signature' };
  const nonce = b64(token.authInput.nonce);
  if (await spent.has(nonce)) return { ok: false, reason: 'already spent' };
  await spent.add(nonce);
  return { ok: true };
}

const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Redemption context: empty means a token isn't bound to one session, so a
// week's allowance can be issued in one batch and spent later. That matters
// for unlinkability (see README).
export function challengeFor(origin, issuerName) {
  return origin.createTokenChallenge(issuerName, new Uint8Array(0)).serialize();
}
