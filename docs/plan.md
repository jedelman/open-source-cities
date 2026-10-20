# Open Source Cities — the app (plan, 2026-10-17)

Source: Jason's Substack post "Open Source Cities" (2025-11-13), in the well at
`power-explained/well/sources/substack/`. Jason (2026-10-17): plan it, in its own
repo, as **an atproto app that is also a source for Siren to work from**.
Status: plan only. Repo: github.com/jedelman/open-source-cities (GPL-3.0).
City: **Norfolk is the test fixture** (Jason, 2026-10-18: "it's what I'm
familiar with"), since Siren's verified data is Norfolk. The lexicons and
indexer stay city-agnostic.

## The idea in one line
City work as signed changes in many people's repos: report, combine, propose,
claim, do, sign off. All of it public, so the history of changes is the record
(the source-control post: "Each commit is signed by its author").

## Why atproto fits, specifically
- **Every record is signed by its author in their own repo.** Provenance comes
  free, and so does "anyone can read, use, and change": anyone can index, fork or
  rank the data. That is composition, not command.
- **Nobody owns the database.** The city can't shut it, and neither can we. An
  index (AppView) is rebuildable from the firehose by anyone.
- **It's the stack Jason already has:**
  - OAuth (PAR/PKCE/DPoP, granular `repo:` scopes) is in skymap's `app/src/oauth.ts`.
  - The location lexicon (`community.lexicon.location.*`) is used by skymap.
  - Relay discovery (`com.atproto.sync.listReposByCollection`) was verified 2026-10-08.

## Records (lexicon sketch; working namespace `org.jason-edelman.oscity.*`; rename freely)
The pothole flow from the post, step by step. Each record is in its author's repo.

| Record | Written by | Holds |
|---|---|---|
| `report` | a neighbor | location (`community.lexicon.location` geo/address + H3), category, text, photo blobs, optional `cityRef` (e.g. Socrata work order id, GPIN) |
| `same` | a neighbor | strongRef to a report: "this is the same issue" (the post's "asking if it's the same issue") |
| `proposal` | anyone | refs to reports, the proposed fix, scope, estimated cost, who should approve |
| `claim` | a worker, crew or contractor | strongRef to a proposal: "I'll do this," with terms |
| `done` | the claimant | strongRef to the claim, photos, notes |
| `signoff` | a neighbor, group member or inspector | strongRef to `done`: approve or reject, with reasons |

Rules carried from skymap: edits use `swapRecord`; locations never move on edit;
an "area only" precision (H3 res-8) exists for anything sensitive.

**Deliberately not in v0:**
- Money. The app can't move city money. The post's "group controls its street
  budget" and dollar voting can be *signaled* (a `budgetPreference` record),
  shown next to the city's real budget data, and nothing more. Say so in the UI.
- Group governance. Who counts as "the neighborhood group" for a signoff is the
  hard question. Candidates: an atproto list, a group DID, or an atproto-iroh
  Table whose ratification produces the signoff. v0 shows every signoff with
  its author and doesn't decide which ones count.

## Pieces
1. **Client** (web first, since civic users are on phones and laptops, not
   Android sideloads). Map + report form + issue page showing the whole chain of
   records. Reuses skymap's OAuth code and MapLibre/OpenFreeMap setup.
2. **Index / AppView.** Unlike skymap, civic work needs *everyone's* reports near
   a place, not just your follows. So we need a small indexer: a Jetstream
   consumer filtered to the `oscity.*` collections, keyed by H3 cell, with a
   public read API (`/near?h3=…`, `/issue/<at-uri>`). Candidate hosting:
   Cloudflare Worker + Durable Object (SQLite). ⚠️ D1 is at its 10-database cap
   (noted 2026-10-08). It must be rebuildable from the firehose, so it holds no
   state that isn't in someone's repo.
3. **Siren plugin** in socrata-agent: `neighbors_on_my_block`. It reads the index
   through `ctx.http.json` (traced, https only, as `plugins/water-on-my-block.js`
   does) and returns reports and their chains near the address's parcel centroid
   (from `ctx.lookupAddress`), each with its `at://` URI. Siren's existing rules
   then hold: "I found 3 neighbor reports…", the trace written by code,
   hand-offs to the records.
   - **Privacy rule, by place never by person:** answer "what's reported on this
     block," never "what has this handle reported" (CONTRIBUTING: no
     people-finding).
4. **Bridge, both directions (phase 2+):**
   - *City → network:* show the city's own work orders (Socrata) on the issue page
     beside the neighbor reports. Norfolk Work Orders carry street + ward but no
     house number, so matching is approximate and must say so.
   - *Network → city:* "operating data public by default" is the post's ask. The
     network is that, for what neighbors see.
   - **Open option:** Siren as its own DID, publishing *mirrors* of city records
     (clearly labeled, never as the city) so neighbors can attach `same` and
     `signoff` to official work. Powerful, but it's a publishing decision with
     impersonation risk. Jason's call.
5. **Code patches (phase 3).** The post's "city code as testable instructions":
   a `patch` record against a code section (section id, current text, proposed
   text, rationale, tests = which real cases it would change). Ghent's HC-G2 /
   Table 3.6.11 amendment is a ready first patch. That ties ghent-zoning-reform
   in.
6. **Blips: the swarm surface (Jason, 2026-10-20; not scheduled).** A second
   way in, for people with no app and no atproto account: their own free-tier
   chatbot files a *blip* by fetching a URL. Free agents can often fetch, but
   they can't POST or sign. Each blip is a weak signal ("something's wrong with
   drainage around here"). Read in aggregate, many blips show where the
   trouble is. The app stays the way in for signed, actionable reports.
   - **Aggregate signal, not reports.** A blip carries a category and an H3
     res-8 cell. Nothing else: no text, no photos, no coordinates, no handle.
     Free text would be a way to report a person, and the aggregate doesn't
     need it. Area-only by construction, because query strings end up in
     logs, browser history and the provider's transcript.
   - **Who signs:** a gateway with its own DID writes each blip as a
     `blip` record in its own repo, labelled as relayed and unsigned. A blip
     is never a `report`. That keeps it public and rebuildable from the
     firehose, and keeps signed reports undiluted. The indexer counts blips per
     cell per category. Siren reads the counts in its own voice: "I see 14
     relayed blips about drainage in this area this month, and 1 signed
     report."
   - **A human click submits (Jason, 2026-10-20; replaces the double GET).**
     The agent only *writes a link*: a prefilled confirm URL it shows to the
     person. The person opens it in their own browser. The page shows the blip
     (category, and the cell on a map) with one Submit button. That button is a
     POST behind a Cloudflare Turnstile check, so only a browser with a person
     at it can submit.
     - **No GET ever writes.** Link previews, prefetchers and the agent's own
       fetch tool all land on a page that does nothing until Submit is pressed.
     - **The agent doesn't need to fetch anything.** Every chatbot can print a
       link, so the open question of whether free agents will fetch a URL they
       built goes away.
     - **Rate limits work again.** Submits come from people's own browsers,
       not the providers' shared egress, and Turnstile is the throttle.
     - **Prompt injection can't finish an attack.** A hostile page can make an
       agent write a link, but a person still has to open it and press Submit.
     - **The person checks what the agent understood.** If the cell on the map
       is wrong, they tap the right one before submitting. That's the fix for
       models geocoding badly.
     - **Cost:** it's two actions (open, Submit), not one, and lower volume
       than an agent-only swarm. But every blip has a person behind it, which
       is worth more than a bigger, noisier count. Auto-submitting on page load
       (an invisible challenge, no button) would make it truly one click, but
       it gives up the confirmation step, and agents that drive a real browser
       would pass the challenge. Don't.
   - **Location: H3 cells, with Nominatim for addresses (Jason, 2026-10-20).**
     The agent puts an `addr` and its best-guess `lat`/`lng` in the URL
     *fragment*, which browsers never send to the server. The confirm page
     geocodes the `addr` with Nominatim (OpenStreetMap's geocoder) and falls
     back to the agent's coordinates. It snaps the result to a res-8 cell with
     h3-js, the same cells as the atproto maps, and the person taps the right
     cell if it's off. Only the cell is submitted.
     - **Strip the address once it's used.** After geocoding, the page
       removes it from the URL (`history.replaceState`), so browser history
       keeps only the cell. It matters most when the address is the person's
       own ("outside my front door"; ChatGPT asked for it, 2026-10-20).
     - **Call it from the browser, not the gateway**, so our server never sees
       an address. Nominatim's operator does see the address and the person's
       IP. Their log retention is unchecked, so check it before launch.
     - **The public instance won't carry a swarm.** Its usage policy allows at
       most 1 request/s per application, requires an identifying User-Agent
       or Referer, and asks for caching. That's fine for the test and a small
       pilot. At scale, self-host Nominatim on a Virginia extract (not on
       Workers: it needs Postgres) or use a hosted Nominatim provider.
     - **Baseline:** 11 of 11 test queries landed in the true cell
       (`experiments/magic-link-test/README.md`).
   - **The ladder (Jason, 2026-10-20).** The confirm page offers optional
     sign-in, and each rung upgrades the same blip. None of them needs an app
     installed.
     1. *Anonymous:* Submit + Turnstile gives a blip, counted as a click.
     2. *Signed in with Google, Apple or Microsoft (OpenID Connect):* a blip
        counted as a person. This counts people, not clicks, and gives a
        per-person rate limit. It must stay **unlinkable**. Sign-in mints a
        small weekly allowance of blind-signed tokens (Privacy Pass, RFC
        9576–9578), and each blip spends one. The gateway can check that a
        token is valid but can't tell which sign-in it came from. *Fallback:*
        a keyed hash of the account ID, with the key rotated monthly and the
        ID discarded. That's weaker, because it links a person's blips within
        a month. Either way the gateway never stores the account ID next to a
        cell: blips over time would reveal where someone lives, and that list
        would be worth subpoenaing. *Tested 2026-10-20*
        (`experiments/privacy-pass/`): Cloudflare's `privacypass-ts` runs off
        the shelf. The issuer and gateway work in workerd, and the client works
        in Chromium. Issuing needs workerd's native RSA-RAW (about 1 ms versus
        about 330 ms without it). Mint the week's allowance in one batch at
        sign-in, so the issuer can't match an issue to a spend by timing.
     3. *Signed in with an atproto handle (OAuth, still just a web page):* the
        page writes a signed `report` into the person's own repo instead of a
        blip, and they're in the full app.
     Sign-in is an upgrade, never a gate. The index shows the rungs apart:
     "9 people, plus 23 anonymous blips; 2 signed reports." *Tension:* the
     identity providers become the ones who vouch that someone is a person.
     They see that someone used a civic tool, and they can cut it off. That's
     tolerable as one option among several that only ever upgrades a blip.
   - **What it doesn't solve:** authorship below rung 3. The gateway knows a
     person clicked, or that some account exists, not who signed. So blips stay
     aggregate-only and unsigned, and a determined group of real people can
     still pile into one cell. The indexer shows spikes as spikes instead of
     averaging them in.
   - **Test before building:** `experiments/magic-link-test/`. Each free agent
     (ChatGPT, Gemini, claude.ai) gets the same instructions and nine cases.
     The cases are built from addresses verified in the city's dataset, plus
     one about a person that the agent should decline. A scorer checks the
     category, that the fields are in the fragment, and the distance in H3
     rings. Variant B, a fetch probe with code words, tests whether agents
     can fetch a URL they built (that matters for Siren's co-agency). Not run
     yet; the kit needs a person at each chatbot.
   - **Onboarding is one paste (Jason, 2026-10-20).** No model will know the
     link format from general knowledge, so the person gives it to their
     agent once, in either of two ways:
     a link ("read oscity.jason-edelman.org/agents and help me report
     something"), which the agent fetches to get the instructions, or the
     instruction block itself, pasted. Both are fine. The paste works today
     (Gemini, 8 of 8 on content). The link needs a live host and an agent
     that fetches (variant B of the test). Both should serve the same text, so
     the instructions live in one file. Installed carriers (a custom GPT, a
     Gem, a connector) would skip even that step. Which free tiers allow them
     is unchecked.
   - **Federation (Jason, 2026-10-20).** We operate the first gateway. Blip
     writes don't conflict (each gateway writes to its own repo, and the
     indexer takes the union), so anyone can run another. The one piece of
     shared state is *spent tokens*. Each gateway names itself as the origin
     in its token challenges and checks that binding on redemption, so a token
     minted for one gateway can't be spent at another. The library doesn't
     check it; tested 2026-10-20. Each gateway keeps its own spent set. Anonymous blips sent to two
     gateways count twice; at the bottom rung that's acceptable.

## Phases
- **0 — Repo + lexicons + this plan.** Lexicon JSON validated the way skymap did
  (field shapes checked against lexicon-community). No UI.
- **1 — Report + same + map + index.** Write with OAuth, read from the index.
  Done when two real accounts can report one issue, see it combined, and Siren's
  CLI answers "what's reported near X" with a trace.
- **2 — The chain.** Proposal → claim → done → signoff on one issue page; the
  city's work orders shown alongside.
- **3 — Patches and budget preference** (signal only).
- Each phase ships, per "finish means shipped."

## Risks
- **Cold start:** reports need neighbors (the 9/27 finding: "the missing layer
  is users"). Siren helps here, since it is useful with zero reports because the
  city data already exists.
- **Public by default is unsafe for some reports.** Code enforcement against
  your landlord, or encampments, become a surveillance or retaliation tool. Some
  categories may need area-only precision, or shouldn't exist. Decide before v1.
- **Moderation and defamation** for photos and text about named businesses.
  Labelers are the atproto answer; we'd need one.
- **The city ignores it.** Fine: the post's point is that the people closest to
  the problem have the best information. But don't promise neighbors that a
  report reaches the city unless it does.
- **Siren isn't live yet.** Its deploy (PR #3, `7c6f816`) is unmerged, and
  socrata-agent `main` has no Siren skin. The plugin can be built and tested
  through the CLI regardless.

## Open questions (Jason's)
1. ~~Name and repo~~: decided, `jedelman/open-source-cities`.
2. ~~City~~: decided, Norfolk as the test fixture.
3. **Standalone, or a skymap layer?** Separate lexicons either way. The question
   is one app or two. Leaning: a separate client sharing skymap's code, since the
   audiences differ.
4. **Does Siren write** (its own DID, publishing mirrors), or only read?
5. **Who signs off,** and is that where an atproto-iroh Table comes in?
6. ~~**Blips:** geocoder; gateway DID.~~ Decided 2026-10-20: H3 with no
   geocoder, and we operate a gateway of our own that others can federate
   with (see `docs/decisions.md`).
