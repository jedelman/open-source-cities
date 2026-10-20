# Can a Worker do Privacy Pass off the shelf?

For rung 2 of the blip ladder (`docs/plan.md` → Blips): sign-in mints a
weekly allowance of unlinkable tokens, and each blip spends one. This
experiment runs the three roles (RFC 9576) with Cloudflare's
[`@cloudflare/privacypass-ts`](https://github.com/cloudflare/privacypass-ts)
0.9.0, using publicly verifiable tokens (blind RSA, RFC 9578 type 2).

- **Issuer:** behind sign-in, hands out tokens. In `worker.js`.
- **Origin:** the blip gateway, accepts one token per blip. Also in `worker.js`.
- **Client:** the confirm page in the person's browser. `roles.js`, bundled
  by `client-entry.js`.

```bash
cd experiments/privacy-pass && npm install && npm test
```

The tests run Node, workerd (Cloudflare's Workers runtime, via Miniflare) and
headless Chromium (the preinstalled one, through Playwright). They're kept out
of the root `npm test` because they need these dev dependencies.

## Results (2026-10-20)

**Yes, it works off the shelf.** All 12 tests pass.

| What | Where | Result |
|---|---|---|
| Issue → redeem → second redeem refused | Node, workerd, Chromium client | ✅ |
| Tampered token, another issuer's token, garbage | Node, workerd | refused ✅ |
| Token minted for gateway A spent at gateway B | Node | refused ✅, **but only after adding our own check** (below) |
| Keys loaded from bindings (PKCS#8 / SPKI), the way secrets work | workerd | ✅ |
| Token size | | 354 bytes |

Timings on this machine (one run each; treat them as orders of magnitude):

| Step | Cost |
|---|---|
| Issue, workerd, native RSA-RAW | **~1.3 ms** |
| Issue, workerd, the library's BigInt fallback | ~330 ms |
| Issue, Node (BigInt) | ~360 ms |
| Client request + finalize, Chromium | ~146 + ~18 ms |
| Redeem (verify) | <1 ms |

## What it means for the build

1. **Turn on native RSA-RAW in the issuer** (`makeIssuer(..., { native: true })`,
   i.e. `supportsRSARAW: true`). That operation is specific to workerd, and
   it's what makes issuing cheap. Without it, every token costs about a third
   of a second of CPU, far past the Workers Free plan's CPU limit per request
   (10 ms when I last knew it; check Cloudflare's current limits).
2. **Check the gateway binding ourselves.** The library's `Origin.verify`
   checks only the signature. A token minted for one gateway would redeem at
   any other gateway that trusts the same issuer. `redeem()` in `roles.js`
   compares the token's challenge digest with the gateway's own challenge
   first. That is what makes federation work: each gateway keeps its own
   spent set, and tokens can't cross between gateways.
3. **The spent set needs real storage.** The test uses an in-memory Set; a
   deployed gateway needs a Durable Object.
4. **Batch-issue the allowance.** Unlinkability is cryptographic (RFC 9474's
   blindness), but timing can undo it: if a token is minted and then spent a
   second later, an operator running both the issuer and the gateway can
   match the two. Mint the week's tokens in one batch at sign-in, keep them
   in the browser, and spend them later. The challenge uses an empty
   redemption context, so a token isn't tied to one session.
5. **Not tested here:** sign-in itself (OpenID Connect), per-account weekly
   limits at the issuer, key rotation, or a deployed Worker. Deployed Workers
   freeze timers during CPU work, so the timings above come from local
   workerd.

The check that the issuer's view and the gateway's view don't match is a
sanity check, not a proof. The proof is the blindness property of the blind
RSA signature scheme.
