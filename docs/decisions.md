# Decisions

## 2026-10-18 — Phase 0 (Claude's calls, for Jason to confirm or overturn; namespace confirmed)

**Namespace: `org.jason-edelman.oscity.*`. Confirmed by Jason, 2026-10-19:
"org.jason-edelman.oscity is good!"** It's fixed from here on: once real
records exist in people's repos, a rename strands them.

**Six record types, one per step of the pothole flow:** `report`, `same`,
`proposal`, `claim`, `done`, `signoff`, plus `defs` (image, cityRef, money).
Each step points at the one before it with a `strongRef` (URI + CID), so a
later edit to an earlier record can't silently change what was agreed to.

**Location is a union of geo | address | hthree,** the same union skymap uses
minus `fsq`. Area-only is an H3 resolution-8 cell (about 0.7 km², a few blocks)
with no other location field. That is enforced in the builder and tested by
checking the record contains no coordinate. The caveat from skymap applies:
area-only is only as private as everything else the account publishes.

**Categories are open (`knownValues`), and all of them are about things:**
pothole, sidewalk, drainage, flooding, streetlight, signal, sign, tree, litter,
other. Code enforcement, encampments and anything else about people are left
out on purpose (plan, "Risks").

**What the builders enforce beyond the schema:**
- Each step's subject must be the right collection (a claim points at a
  proposal, and so on).
- Photos need alt text.
- A reject needs reasons.
- Money is whole minor units with an ISO 4217 code.
- `cityRef.url` must be https.

**Not decided here:** who counts for a signoff; whether Siren gets its own DID;
standalone app vs. skymap layer. See the plan's open questions.

**Lexicon publication (later).** atproto resolves `org.jason-edelman.oscity.*`
through a `_lexicon` TXT record on `oscity.jason-edelman.org`, pointing at the
DID whose repo holds `com.atproto.lexicon.schema` records. Not done in phase 0;
it needs Jason's DNS.

## 2026-10-20 — Blips (Jason)

**Location: H3 cells, with Nominatim for addresses.** "Use H3, same as our
atproto maps," then, the same day, "can we use Nominatim?" The agent's `addr`
and lat/lng guess ride in the URL fragment. The confirm page geocodes the
address with Nominatim *from the browser* (our server never sees it), snaps the
result to a res-8 cell, and the person taps to correct it. Only the cell is
submitted. The public Nominatim instance (≤1 request/s) does for the test and
a pilot; self-host or use a hosted provider at scale.

**Gateway: we operate it for now, federated by design.** "I'm seeing it as
something that can be federated since writes are non-conflicting." Each
gateway is its own DID writing `blip` records to its own repo, and the indexer
takes the union. Spent tokens are the only shared state, so tokens are bound
to one gateway (origin name in the challenge, checked by the gateway itself,
because the library's verify doesn't) and each gateway keeps its own spent set.

**Privacy Pass is feasible** (`experiments/privacy-pass/`, run 2026-10-20).
Use the native RSA-RAW path in the issuer, and batch-issue the weekly
allowance.

**Siren: co-agency becomes its main surface** (recorded in
socrata-agent `docs/co-agency.md`).
