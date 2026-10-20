# Gemini (free), 2026-10-20: which links get wrapped?

Every blip link to `oscity.jason-edelman.org` (not live; the host doesn't
resolve) came back with its target wrapped in `google.com/search?q=…`.
Diagnostic, same chat, link target checked by Jason with "Copy link address":

| Link asked for | Host | Wrapped? |
|---|---|---|
| `https://en.wikipedia.org/wiki/Norfolk,_Virginia#History` | live, well known | **no** |
| `https://claude.jason-edelman.org/#test` | live, ours, little traffic | pending |

If the second isn't wrapped, the cause is a host that doesn't resolve, and
making `oscity.jason-edelman.org` live should fix it. If it is wrapped, Gemini
wraps hosts it doesn't know, and a live host won't be enough on its own.
