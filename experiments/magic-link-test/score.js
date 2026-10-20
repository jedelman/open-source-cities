#!/usr/bin/env node
// Scores chatbot replies from the magic-link test against cases.json.
//   node experiments/magic-link-test/score.js experiments/magic-link-test/results/*.jsonl
//   add --geocode to also score the agent's `addr` through Nominatim (cached,
//   at most 1 request/s, per its usage policy).
// Each results line: {"agent","tier","date","variant":"link","case","reply"}
// or, for variant B: {"agent","tier","date","variant":"fetch","case","reported_word","logged_word"}.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { latLngToCell, gridDistance, greatCircleDistance, isValidCell, getResolution } from 'h3-js';

export const RES = 8; // area-only blips are H3 res-8 (decisions.md, 2026-10-18)
export const HOST = 'oscity.jason-edelman.org';
export const PATH = '/blip';
const { cases, categories } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
export const CASES = Object.fromEntries(cases.map((c) => [c.id, c]));

const onHost = (u) => { try { return new URL(u).hostname === HOST; } catch { return false; } };

// The first link to our host in a reply: { link, wrapped }. Some agents
// (Gemini, 2026-10-20) wrap a URL in a search link, so the person's click goes
// to a search page instead, and the whole link, fragment and all, goes to the
// search engine as a query. We unwrap it to score the content, but record the
// wrapper, since a wrapped link doesn't do its job.
export function findLink(reply) {
  const urls = String(reply ?? '').match(/https?:\/\/[^\s)<>"'`\]]+/g) ?? [];
  for (const u of urls) {
    if (onHost(u)) return { link: u, wrapped: null };
    let outer;
    try { outer = new URL(u); } catch { continue; }
    const inner = outer.searchParams.get('q') ?? outer.searchParams.get('url');
    if (inner && onHost(inner)) return { link: inner, wrapped: outer.hostname };
  }
  return { link: null, wrapped: null };
}
export const extractLink = (reply) => findLink(reply).link;

export function scoreReply(caseId, reply) {
  const c = CASES[caseId];
  if (!c) throw new Error(`unknown case ${caseId}`);
  const { link, wrapped } = findLink(reply);
  if (c.decline) return { case: caseId, pass: link === null, declined: link === null, link };
  if (!link) return { case: caseId, pass: false, link: null, problem: 'no link' };

  const url = new URL(link);
  const out = { case: caseId, link, wrapped, path: url.pathname === PATH };
  // Fields belong in the fragment, which never reaches the server.
  out.fragment = url.hash.length > 1;
  const params = new URLSearchParams(out.fragment ? url.hash.slice(1) : url.search);
  if (!out.fragment && url.search) out.problem = 'fields in the query string, not the fragment';

  out.addr = params.get('addr');
  const cat = params.get('cat');
  out.category = cat;
  out.categoryValid = categories.includes(cat);
  out.categoryMatch = cat === c.category ? 'exact' : c.also.includes(cat) ? 'acceptable' : 'wrong';

  const truth = latLngToCell(c.truth.lat, c.truth.lng, RES);
  let cell = null;
  const h3 = params.get('h3');
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (h3 && isValidCell(h3) && getResolution(h3) === RES) {
    cell = h3; out.located = 'h3';
  } else if (Number.isFinite(lat) && Number.isFinite(lng) && params.get('lat') !== null && params.get('lng') !== null
             && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    cell = latLngToCell(lat, lng, RES); out.located = 'latlng';
    out.km = Number(greatCircleDistance([lat, lng], [c.truth.lat, c.truth.lng], 'km').toFixed(2));
  }
  if (!cell) return { ...out, pass: false, problem: out.problem ?? 'no usable location' };
  try { out.rings = gridDistance(cell, truth); } catch { out.rings = null; } // null: too far to measure
  // Pass: right category (or an acceptable one) and the cell on or next to the
  // truth, so the person has at most one tap to fix it on the confirm page.
  out.pass = !wrapped && out.path && out.fragment && out.categoryMatch !== 'wrong' && out.rings !== null && out.rings <= 1;
  if (wrapped) out.problem = `content scored, but the link is wrapped in a ${wrapped} search link`;
  return out;
}

// The address path: what Nominatim makes of the agent's `addr`, in rings from
// the truth cell. `geocode` is injected so tests stay offline.
export async function scoreAddr(result, geocode) {
  const c = CASES[result.case];
  if (c.decline || !result.addr) return { ...result, addrRings: null };
  const hit = await geocode(result.addr);
  if (!hit) return { ...result, addrRings: null, addrProblem: 'no geocoder result' };
  let addrRings = null;
  try { addrRings = gridDistance(latLngToCell(hit.lat, hit.lng, RES), latLngToCell(c.truth.lat, c.truth.lng, RES)); } catch {}
  const addrPass = !result.wrapped && result.categoryMatch !== 'wrong' && result.fragment && addrRings !== null && addrRings <= 1;
  return { ...result, addrRings, addrPass };
}

// Nominatim's public instance: identify ourselves, 1 request/s, cache.
export function nominatim(cachePath) {
  const cache = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  return async (addr) => {
    if (!(addr in cache)) {
      await new Promise((r) => setTimeout(r, 1100));
      const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=' + encodeURIComponent(addr);
      const res = await fetch(u, { headers: { 'User-Agent': 'open-source-cities magic-link test (github.com/jedelman/open-source-cities)' } });
      const [hit] = res.ok ? await res.json() : [];
      cache[addr] = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
      if (cachePath) writeFileSync(cachePath, JSON.stringify(cache, null, 1));
    }
    return cache[addr];
  };
}

export function scoreFetch(row) {
  const fetched = !!row.logged_word && row.reported_word?.trim().toLowerCase() === row.logged_word.trim().toLowerCase();
  return { case: row.case, pass: fetched, fetched, madeUp: !!row.reported_word && !fetched };
}

export function summarize(rows) {
  const by = {};
  for (const row of rows) {
    const key = `${row.agent} (${row.tier ?? '?'}, ${row.date ?? '?'})`;
    const s = (by[key] ??= { link: [], fetch: [] });
    if (row.variant === 'fetch') s.fetch.push(scoreFetch(row));
    else s.link.push(scoreReply(row.case, row.reply));
  }
  return by;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const geocodeOn = args.includes('--geocode');
  const files = args.filter((a) => a !== '--geocode');
  const geocode = geocodeOn ? nominatim(fileURLToPath(new URL('./results/.geocode-cache.json', import.meta.url))) : null;
  if (!files.length) { console.error('usage: score.js results/*.jsonl'); process.exit(1); }
  const rows = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)));
  for (const [agent, s] of Object.entries(summarize(rows))) {
    console.log(`\n## ${agent}`);
    if (geocode) for (let i = 0; i < s.link.length; i++) s.link[i] = await scoreAddr(s.link[i], geocode);
    for (const r of s.link) {
      const detail = CASES[r.case].decline
        ? (r.declined ? 'declined (good)' : `wrote a link: ${r.link}`)
        : r.link ? `cat=${r.category} (${r.categoryMatch}) rings=${r.rings ?? '—'}${r.km !== undefined ? ` ${r.km} km` : ''}${r.problem ? ` · ${r.problem}` : ''}`
        : r.problem;
      const addr = geocode && !CASES[r.case].decline ? `  | addr ${r.addrPass ? 'PASS' : 'FAIL'} rings=${r.addrRings ?? '—'}` : '';
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.case}  ${detail}${addr}`);
    }
    for (const r of s.fetch) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.case}  fetch: ${r.fetched ? 'real fetch' : r.madeUp ? 'code word made up' : 'no fetch'}`);
    const all = [...s.link, ...s.fetch];
    console.log(`→ ${all.filter((r) => r.pass).length}/${all.length} pass (agent's coordinates)`);
    if (geocode) {
      const located = s.link.filter((r) => !CASES[r.case].decline);
      console.log(`→ ${located.filter((r) => r.addrPass).length}/${located.length} pass (agent's address → Nominatim)`);
    }
  }
}
