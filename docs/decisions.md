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
