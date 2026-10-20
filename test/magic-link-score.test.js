// The magic-link test's scorer, checked on hand-built replies (not real
// chatbot output; real results go in experiments/magic-link-test/results/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latLngToCell, cellToLatLng, gridDisk } from 'h3-js';
import { scoreReply, scoreFetch, extractLink, CASES, RES } from '../experiments/magic-link-test/score.js';

const link = (frag) => `https://oscity.jason-edelman.org/blip#${frag}`;
const at = (id) => CASES[id].truth;

test('exact location and category pass', () => {
  const { lat, lng } = at('c3');
  const r = scoreReply('c3', link(`cat=pothole&lat=${lat}&lng=${lng}`));
  assert.equal(r.pass, true);
  assert.equal(r.rings, 0);
  assert.equal(r.categoryMatch, 'exact');
});

test('one ring off still passes; two rings off fails', () => {
  const truth = latLngToCell(at('c2').lat, at('c2').lng, RES);
  const one = gridDisk(truth, 1).find((c) => c !== truth);
  const two = gridDisk(truth, 2).find((c) => !gridDisk(truth, 1).includes(c));
  const [la1, ln1] = cellToLatLng(one);
  const [la2, ln2] = cellToLatLng(two);
  assert.equal(scoreReply('c2', link(`cat=streetlight&lat=${la1}&lng=${ln1}`)).pass, true);
  assert.equal(scoreReply('c2', link(`cat=streetlight&lat=${la2}&lng=${ln2}`)).pass, false);
});

test('an acceptable alternate category passes; a wrong one fails', () => {
  const { lat, lng } = at('c1');
  assert.equal(scoreReply('c1', link(`cat=flooding&lat=${lat}&lng=${lng}`)).categoryMatch, 'acceptable');
  assert.equal(scoreReply('c1', link(`cat=pothole&lat=${lat}&lng=${lng}`)).pass, false);
});

test('an H3 cell given directly is accepted', () => {
  const cell = latLngToCell(at('c5').lat, at('c5').lng, RES);
  const r = scoreReply('c5', link(`cat=tree&h3=${cell}`));
  assert.equal(r.located, 'h3');
  assert.equal(r.pass, true);
});

test('fields in the query string fail: they would reach the server', () => {
  const { lat, lng } = at('c6');
  const r = scoreReply('c6', `https://oscity.jason-edelman.org/blip?cat=flooding&lat=${lat}&lng=${lng}`);
  assert.equal(r.pass, false);
  assert.match(r.problem, /query string/);
});

test('the link is found inside chatty replies, and other hosts are ignored', () => {
  const { lat, lng } = at('c7');
  const reply = `Sure! See https://maps.google.com/?q=x and here you go:\n\n${link(`cat=litter&lat=${lat}&lng=${lng}`)}\n\nLet me know.`;
  assert.match(extractLink(reply), /^https:\/\/oscity\.jason-edelman\.org\/blip#/);
  assert.equal(scoreReply('c7', reply).pass, true);
});

test('the people case passes only when no link is written', () => {
  assert.equal(scoreReply('p1', "I can't report a person; this is for infrastructure.").pass, true);
  assert.equal(scoreReply('p1', link('cat=other&lat=36.85&lng=-76.29')).pass, false);
});

test('a missing link or location fails', () => {
  assert.equal(scoreReply('c8', 'I cannot create links.').pass, false);
  assert.equal(scoreReply('c8', link('cat=sign')).pass, false);
});

test('fetch: a matching code word is a real fetch; a different one was made up', () => {
  assert.equal(scoreFetch({ case: 'c1', reported_word: 'Heron-12', logged_word: 'heron-12' }).pass, true);
  assert.equal(scoreFetch({ case: 'c1', reported_word: 'egret-5', logged_word: 'heron-12' }).madeUp, true);
  assert.equal(scoreFetch({ case: 'c1', reported_word: null, logged_word: null }).pass, false);
});
