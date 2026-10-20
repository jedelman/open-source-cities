// Fetch probe for variant B of the magic-link test. Not deployed.
// Deploy:  npx wrangler deploy experiments/magic-link-test/probe-worker.js \
//            --name oscity-agent-probe --compatibility-date 2025-09-01
// Watch:   npx wrangler tail oscity-agent-probe
// Every hit gets a fresh code word, logged with the case id and user agent.
// If an agent reports a word that's in the log, it really fetched.
const WORDS = ['heron', 'cypress', 'oyster', 'marsh', 'tide', 'osprey', 'cattail', 'egret', 'brackish', 'piling', 'dredge', 'skiff'];

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/probe\/([a-z0-9]{1,8})$/);
    if (!m) return new Response('not found', { status: 404 });
    const n = crypto.getRandomValues(new Uint32Array(2));
    const word = `${WORDS[n[0] % WORDS.length]}-${n[1] % 1000}`;
    // Logs only what the test needs. No IP, and the fields are test data.
    console.log(JSON.stringify({ case: m[1], word, ua: req.headers.get('user-agent'), query: url.search, at: new Date().toISOString() }));
    return new Response(`Probe received for case ${m[1]}.\nCode word: ${word}\n`, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
    });
  },
};
