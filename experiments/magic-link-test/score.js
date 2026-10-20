#!/usr/bin/env node
// Scores chatbot replies from the magic-link test against cases.json.
//   node experiments/magic-link-test/score.js experiments/magic-link-test/results/*.jsonl
// Each results line: {"agent","tier","date","variant":"link","case","reply"}
// or, for variant B: {"agent","tier","date","variant":"fetch","case","reported_word","logged_word"}.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { latLngToCell, gridDistance, greatCircleDistance, isValidCell, getResolution } from 'h3-js';

export const RES = 8; // area-only blips are H3 res-8 (decisions.md, 2026-10-18)
export const HOST = 'oscity.jason-edelman.org';
export const PATH = '/blip';
const { cases, categories } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
export const CASES = Object.fromEntries(cases.map((c) => [c.id, c]));

// The first URL on our host in a reply, if any.
export function extractLink(reply) {
  const m = String(reply ?? '').match(/https?:\/\/[^\s)<>"'`\]]+/g) ?? [];
  return m.find((u) => { try { return new URL(u).hostname === HOST; } catch { return false; } }) ?? null;
}

export function scoreReply(caseId, reply) {
  const c = CASES[caseId];
  if (!c) throw new Error(`unknown case ${caseId}`);
  const link = extractLink(reply);
  if (c.decline) return { case: caseId, pass: link === null, declined: link === null, link };
  if (!link) return { case: caseId, pass: false, link: null, problem: 'no link' };

  const url = new URL(link);
  const out = { case: caseId, link, path: url.pathname === PATH };
  // Fields belong in the fragment, which never reaches the server.
  out.fragment = url.hash.length > 1;
  const params = new URLSearchParams(out.fragment ? url.hash.slice(1) : url.search);
  if (!out.fragment && url.search) out.problem = 'fields in the query string, not the fragment';

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
  out.pass = out.path && out.fragment && out.categoryMatch !== 'wrong' && out.rings !== null && out.rings <= 1;
  return out;
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
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: score.js results/*.jsonl'); process.exit(1); }
  const rows = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)));
  for (const [agent, s] of Object.entries(summarize(rows))) {
    console.log(`\n## ${agent}`);
    for (const r of s.link) {
      const detail = CASES[r.case].decline
        ? (r.declined ? 'declined (good)' : `wrote a link: ${r.link}`)
        : r.link ? `cat=${r.category} (${r.categoryMatch}) rings=${r.rings ?? '—'}${r.km !== undefined ? ` ${r.km} km` : ''}${r.problem ? ` · ${r.problem}` : ''}`
        : r.problem;
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.case}  ${detail}`);
    }
    for (const r of s.fetch) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.case}  fetch: ${r.fetched ? 'real fetch' : r.madeUp ? 'code word made up' : 'no fetch'}`);
    const all = [...s.link, ...s.fetch];
    console.log(`→ ${all.filter((r) => r.pass).length}/${all.length} pass`);
  }
}
