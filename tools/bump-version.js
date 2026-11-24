#!/usr/bin/env node
// Hooked by Pleun — versie op ALLE plekken tegelijk zetten (sinds v3.6.1)
//
//   node tools/bump-version.js 3.6.2     → zet overal 3.6.2 (+ datum van vandaag)
//   node tools/bump-version.js --check   → controleer dat alles gelijk is (exit 1 bij verschil)
//
// Plekken: ?v= achter eigen css/js in alle .html, <span class="version-tag">,
// js/config.js (version + versionDate), sw.js (CACHE_VERSION), data/version.json.
// Waarom: sw-register.js vergelijkt config.js met data/version.json; staan die
// niet gelijk, dan herlaadt elke bezoeker. Dus nooit met de hand bumpen.
//
// Leest en schrijft UTF-8 zonder BOM en laat regeleindes (CRLF/LF) ongemoeid
// (in mei gaf een PowerShell-bump kapotte emoji).

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VER = String.raw`\d+\.\d+\.\d+`;
const RE = {
  qv: new RegExp(String.raw`((?:css|js)/[\w.-]+\.(?:css|js))\?v=(${VER})`, 'g'),
  tag: new RegExp(String.raw`(<span class="version-tag">v)(${VER})(</span>)`, 'g'),
  cfgVersion: new RegExp(String.raw`(\bversion:\s*')(${VER})(')`),
  cfgDate: /(\bversionDate:\s*')(\d{4}-\d{2}-\d{2})(')/,
  sw: new RegExp(String.raw`(const CACHE_VERSION = ')(${VER})(')`),
};

// interview.html = losse oude vragenlijst (geen ?v=, eigen v1.0.0) — niet meebumpen
const SKIP = new Set(['interview.html']);

function htmlFiles() {
  const out = [];
  for (const dir of ['.', 'admin']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith('.html') && !SKIP.has(f)) out.push(path.join(dir, f));
    }
  }
  return out;
}

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '');
const write = (rel, s) => fs.writeFileSync(path.join(ROOT, rel), s, 'utf8');

function today() {
  // Nederlandse datum, niet UTC
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

function collect() {
  // Geeft [{file, what, version}] voor elke gevonden plek
  const found = [];
  for (const f of htmlFiles()) {
    const s = read(f);
    for (const m of s.matchAll(RE.qv)) found.push({ file: f, what: m[1] + '?v=', version: m[2] });
    for (const m of s.matchAll(RE.tag)) found.push({ file: f, what: 'version-tag', version: m[2] });
  }
  const cfg = read('js/config.js');
  const mc = cfg.match(RE.cfgVersion);
  found.push({ file: 'js/config.js', what: 'version', version: mc ? mc[2] : null });
  const sw = read('sw.js');
  const ms = sw.match(RE.sw);
  found.push({ file: 'sw.js', what: 'CACHE_VERSION', version: ms ? ms[2] : null });
  const vj = JSON.parse(read('data/version.json'));
  found.push({ file: 'data/version.json', what: 'version', version: vj.version || null });
  found.push({ file: 'data/version.json', what: 'tracker', version: vj.tracker || null });
  return found;
}

function check() {
  const found = collect();
  const truth = found.find(x => x.file === 'js/config.js').version;
  const bad = found.filter(x => x.version !== truth);
  const qv = found.filter(x => x.what.endsWith('?v=')).length;
  console.log(`versie volgens js/config.js: ${truth}`);
  console.log(`${found.length} plekken gecontroleerd (${qv}× ?v=)`);
  if (bad.length) {
    console.log(`\n${bad.length} plek(ken) wijken af:`);
    for (const b of bad) console.log(`  ${b.file}  ${b.what}  = ${b.version}`);
    return false;
  }
  console.log('alles gelijk ✔');
  return true;
}

function bump(next) {
  if (!new RegExp('^' + VER + '$').test(next)) throw new Error('versie moet x.y.z zijn, kreeg: ' + next);
  const datum = today();
  let n = 0;
  const count = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;
  for (const f of htmlFiles()) {
    const s = read(f);
    const t = s.replace(RE.qv, `$1?v=${next}`).replace(RE.tag, `$1${next}$3`);
    if (t !== s) { write(f, t); n += count(RE.qv, s) + count(RE.tag, s); }
  }
  let cfg = read('js/config.js');
  if (!RE.cfgVersion.test(cfg) || !RE.cfgDate.test(cfg)) throw new Error('version/versionDate niet gevonden in js/config.js');
  cfg = cfg.replace(RE.cfgVersion, `$1${next}$3`).replace(RE.cfgDate, `$1${datum}$3`);
  write('js/config.js', cfg);
  let sw = read('sw.js');
  if (!RE.sw.test(sw)) throw new Error('CACHE_VERSION niet gevonden in sw.js');
  write('sw.js', sw.replace(RE.sw, `$1${next}$3`));
  const vjRaw = read('data/version.json');
  const vj = JSON.parse(vjRaw);
  vj.version = next; vj.tracker = next; vj.updatedAt = datum;
  const eol = vjRaw.includes('\r\n') ? '\r\n' : '\n';
  write('data/version.json', JSON.stringify(vj, null, 2).replace(/\n/g, eol) + eol);
  console.log(`gebumpt naar ${next} (${datum}): ${n} plekken in html + config.js + sw.js + version.json`);
}

const arg = process.argv[2];
if (!arg || arg === '-h' || arg === '--help') {
  console.log('gebruik: node tools/bump-version.js <x.y.z> | --check');
  process.exit(arg ? 0 : 2);
}
if (arg === '--check') process.exit(check() ? 0 : 1);
bump(arg);
process.exit(check() ? 0 : 1);
