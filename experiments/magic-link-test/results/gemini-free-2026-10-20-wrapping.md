# Gemini (free), 2026-10-20: which links get wrapped?

Every blip link to `oscity.jason-edelman.org` (not live; the host doesn't
resolve) came back with its target wrapped in `google.com/search?q=…`.
Diagnostic, same chat, link target checked by Jason with "Copy link address":

| Link asked for | Host | Wrapped? |
|---|---|---|
| `https://en.wikipedia.org/wiki/Norfolk,_Virginia#History` | live, well known | **no** |
| `https://claude.jason-edelman.org/#test` | live, ours, little traffic | **no** |

**Reading:** the wrapping follows the host, not how famous the site is. A
little-known live host isn't wrapped, so the likely cause is that
`oscity.jason-edelman.org` doesn't resolve, and making it live should fix it.

**Not yet ruled out:** the two diagnostic links were URLs Jason typed, while
the blip links were ones Gemini built, with a long parameter-laden fragment.
The control is a Gemini-built blip-shaped link on the live host, e.g. asking
for `https://claude.jason-edelman.org/blip#cat=pothole&addr=3500+Granby+St,+Norfolk,+VA&lat=36.87786&lng=-76.27986`.
