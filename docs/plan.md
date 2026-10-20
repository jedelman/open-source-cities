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
   - **Address handling:** the agent may put a rough address in the link
     instead of a cell. Put it in the URL *fragment* (`#addr=…`), which
     browsers never send to the server. The page turns it into a cell in the
     browser and submits only the cell, so the gateway never sees an address.
     The geocoder the page calls still does. Choose one that doesn't keep
     queries, or use the city's address dataset for Norfolk.
   - **What it doesn't solve:** authorship. The gateway knows a person
     clicked, not who they are. So blips stay aggregate-only and unsigned, and
     a determined group of real people can still pile into one cell. The
     indexer shows spikes as spikes instead of averaging them in.
   - **Test before building:** give ChatGPT, Gemini and claude.ai (free tiers)
     a link template and see whether each prints a correct, clickable link
     from a sentence like "the storm drain on Colley by the Harris Teeter
     floods."

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
6. **Blips:** which geocoder does the confirm page use for addresses in the
   URL fragment (a third party, or Norfolk's own address data)? And should the
   gateway DID be Siren's, or a separate one?
