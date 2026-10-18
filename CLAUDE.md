# CLAUDE.md — open-source-cities

City work as signed changes in many people's atproto repos, after Jason's post
"Open Source Cities" (edelmanja.substack.com, 2025-11-13). The plan, phases and
open questions are in `docs/plan.md`; decisions as they're made go in
`docs/decisions.md`. Read both before changing direction. Memory:
`claude-memory/context/open-source-cities-plan.md`.

## Settled (Jason)
- An atproto app, and a source for Siren (the Norfolk deployment of
  `jedelman/socrata-agent`) to read from. 2026-10-17.
- Norfolk is the test fixture, not the target: the lexicons and indexer stay
  city-agnostic. 2026-10-18.

## Rules
- Reuse existing lexicons before inventing: `community.lexicon.location.*`
  (copied from skymap, which checked them against lexicon-community). New NSIDs
  live under `org.jason-edelman.oscity.*`, with a JSON file in `lexicons/` whose
  path matches its id (a test enforces it).
- Every record builder in `src/records.js` has a test that validates its output
  against the lexicon JSON with `@atproto/lexicon`.
- **Privacy rules get a test of what is *not* published**, not just what is. An
  area-only report carries the H3 cell and nothing else.
- Reports are about infrastructure, never about people. No category may become
  a way to report a neighbor. Siren reads by place, never by person.
- The app never moves money. Money fields are estimates and asking prices.
- Whose signoff counts is not decided by the records. Don't add a self-declared
  "role" field that pretends to settle it.
- Don't seed public repos with fake reports. Test records go in Claude's own
  repo (`claude.jason-edelman.org`), clearly labelled, and get deleted
  afterwards. Fixtures in tests are never published.

## Build
- `npm install && npm test` (Node ≥ 20, `node --test`).
