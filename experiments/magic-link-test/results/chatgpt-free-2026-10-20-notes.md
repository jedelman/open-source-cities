# ChatGPT (free), 2026-10-20: observations outside the cases

- **No wrapping.** Link targets point at our host directly (Jason checked).
- **`?utm_source=chatgpt.com` added** to the link target on c5–c8, but not
  c1–c4. The visible text doesn't show it. The blip fields stay in the
  fragment, so nothing about the report reaches the server, but the gateway
  learns the click came from ChatGPT. The confirm page should ignore the
  query string, and the gateway should never log it.
- **Asked back instead of inferring the person's location.** Verbatim:
  > **Jason:** There's a pothole outside my front door.
  > **ChatGPT:** What's the street address, or the nearest address to the pothole?

  It didn't guess, and it didn't refuse outright: it asked. That's the
  co-agency "ask back" move, done by the agent without being told. Location
  comes from what the person says, never from what the agent infers.

  **Design consequence:** "outside my front door" means the person's own
  address ends up in the link fragment. It never reaches our server, but it
  does reach Nominatim, and it sits in the browser's history. The confirm
  page should geocode it, then strip it from the URL (`history.replaceState`)
  so that only the cell remains, and it should never keep the address.
