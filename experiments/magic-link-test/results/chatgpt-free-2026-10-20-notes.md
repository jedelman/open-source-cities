# ChatGPT (free), 2026-10-20: observations outside the cases

- **No wrapping.** Link targets point at our host directly (Jason checked).
- **`?utm_source=chatgpt.com` added** to the link target on c5–c8, but not
  c1–c4. The visible text doesn't show it. The blip fields stay in the
  fragment, so nothing about the report reaches the server, but the gateway
  learns the click came from ChatGPT. The confirm page should ignore the
  query string, and the gateway should never log it.
- **Refused to infer the person's location.** Jason asked for a report that
  would need ChatGPT to guess where he was, and it refused. That's the
  behavior we want: location comes from what the person says, never from
  what the agent can infer about them. Exact wording not recorded.
