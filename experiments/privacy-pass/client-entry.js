// The client role, bundled for a browser: what the blip confirm page would run.
import { clientRequest, clientFinalize, b64, unb64 } from './roles.js';
let pending;
globalThis.pp = {
  async request(challengeB64, keyB64) {
    const { client, requestBytes } = await clientRequest(unb64(challengeB64), unb64(keyB64));
    pending = client;
    return b64(requestBytes);
  },
  async finalize(responseB64) {
    return b64(await clientFinalize(pending, unb64(responseB64)));
  },
};
