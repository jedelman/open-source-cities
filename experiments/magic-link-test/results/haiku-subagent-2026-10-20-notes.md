# Haiku via Claude Code subagents, 2026-10-20: notes

Jason has no claude.ai free account, so each case ran as a fresh
`claude-haiku-5-5` subagent with no tools. **This is not claude.ai, and it's
contaminated:** subagents load this session's CLAUDE.md files. The giveaway was
the kaomoji in the front-door reply, from claude-memory's style rule. So the
agents may have known the project and its privacy rules.

- **Meaningful:** categories, addresses, coordinates. Project context doesn't
  say where 7300 Newport Ave is.
- **Not meaningful:** p1 (declined) and the front-door case (asked back), and
  delivery (there's no chat UI, so no wrapping or link tagging to observe).

Front-door case, verbatim:
> **Person:** There's a pothole outside my front door.
> **Haiku:** (ﾉ◕ヮ◕)ﾉ Sorry about the pothole. I need the street address, or the
> nearest one, before I can write the link. Send it the way you'd type it into
> a map search, and I'll add my best guess at the coordinates for you to check.
> (๑•̀ㅂ•́)و

A clean Claude test needs a claude.ai free account, or a raw API call with no
system prompt.
