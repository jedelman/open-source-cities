# Magic-link test: can free-tier agents write a blip link?

For the blip surface (`docs/plan.md` → Blips). The person's own chatbot writes
a prefilled link; the person opens it, checks the H3 cell on a map, and
presses Submit. This kit measures whether each free agent can do its part.

**Status: built, not run.** It needs a person at each chatbot. Nothing in
`results/` is real until someone runs it.

## What it measures

**Variant A, link (the blip path).** Does the agent print a correct link?
- Is the link on our host and path, with the fields in the **fragment** (`#`)
  and not the query string (`?`)? Fields in the query string would reach the
  server.
- Is the category right (or an acceptable alternate)?
- How far off is the location, in H3 res-8 rings from the true cell? **Pass
  is ≤ 1 ring**: at most one tap for the person to fix.
- Case `p1` is about a person. Pass means **no link**.

**Variant B, fetch (for Siren's co-agency).** Will the agent fetch a URL it
built itself? The probe Worker answers every hit with a fresh code word and
logs it. A reported word that's in the log means a real fetch; any other word
means the agent made it up, which is also worth knowing.

## Running it

1. For each agent (ChatGPT, Gemini and claude.ai, signed in on a **free**
   tier, in a new chat with no memory), paste the block from
   `instructions.md`, then send each sentence from `cases.json` in order.
2. Save each reply in full, one JSON object per line, in
   `results/<agent>-<date>.jsonl`:
   ```json
   {"agent":"chatgpt","tier":"free","date":"2026-10-21","variant":"link","case":"c1","reply":"<the whole reply>"}
   ```
3. Score:
   ```bash
   node experiments/magic-link-test/score.js --geocode experiments/magic-link-test/results/*.jsonl
   ```
   Each case is scored two ways from the same reply: the agent's own
   coordinates, and its `addr` run through Nominatim (`--geocode`; cached in
   `results/.geocode-cache.json`, at most 1 request/s per Nominatim's usage
   policy). Leave out `--geocode` to stay offline.

**Nominatim baseline (2026-10-20):** the eight cases' addresses and landmark
names (11 queries) all landed in the true res-8 cell. One, 113 Waterside
Drive, matched the road rather than the building, 752 m off but still in the
same cell. So if agents write a decent address, the geocoder isn't the weak
link.

**Variant B** needs `probe-worker.js` deployed (commands at the top of the
file; it needs a Cloudflare login) and the host in `instructions.md` changed
to the probe's. Record each hit as
`{"variant":"fetch","case":"c1","reported_word":"…","logged_word":"…"}`, with
the logged word from `wrangler tail`.

## Ground truth

Every case's coordinates are the parcel point from Norfolk's address dataset,
looked up 2026-10-20 with socrata-agent's `lookup_address`. The three named
landmarks (Chrysler Museum, Slover Library, Virginia Zoo) were checked against
public listings the same day. The cases use public buildings and plain street
addresses, and no case names a person.

`oscity.jason-edelman.org/blip` is not live. For variant A that doesn't
matter, because the scorer only reads the text. If an agent refuses because
the link is dead, record that too.

The scorer's own tests (`test/magic-link-score.test.js`) use hand-built
replies, never real chatbot output.
