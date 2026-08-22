#!/usr/bin/env node
/* Focused static checks for docs/continuity-lantern.html.
 * These complement the full FreeLattice smoke suite without changing it.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pagePath = path.join(root, 'docs', 'continuity-lantern.html');
const page = fs.readFileSync(pagePath, 'utf8');
const checks = [];

function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
}

check('page exists and declares HTML5', /^<!doctype html>/i.test(page));
check('local-only promise is visible', /Local-only by design/.test(page));
check('context is explicitly distinguished from memory', /does not create memory or prove identity/.test(page));
check('all six continuity fields exist', ['names', 'truths', 'context', 'boundaries', 'unfinished', 'closing'].every(id => new RegExp(`id="${id}"`).test(page)));
check('uses a namespaced localStorage key', /freelattice_continuity_lantern_v1/.test(page));
check('supports plain-text copy', /navigator\.clipboard\.writeText/.test(page));
check('supports open JSON export', /application\/json/.test(page) && /JSON\.stringify\(payload/.test(page));
check('supports JSON import', /accept="application\/json,\.json"/.test(page) && /file\.text\(\)/.test(page));
check('clear action has an inline confirmation panel', /id="clear-confirm"/.test(page) && /id="clear-confirm-button"/.test(page));
check('does not use blocking confirm()', !/\bconfirm\s*\(/.test(page));
check('contains no remote script source', !/<script[^>]+src=["']https?:\/\//i.test(page));
check('contains no analytics or tracking hooks', !/analytics|gtag|google-analytics|facebook pixel|umami/i.test(page));
check('uses an integrity digest', /SHA-256/.test(page) && /crypto\.subtle\.digest/.test(page));
check('integrity seal names its exact scope', /scope: 'canonical lantern JSON without the integrity object'/.test(page));
check('sealed imports are verified before acceptance', /Integrity seal does not match this lantern file/.test(page) && /integrityVerified/.test(page));
check('respects reduced-motion preference', /prefers-reduced-motion/.test(page));
check('includes a keyboard skip link', /class="skip-link"/.test(page));
check('status messages use aria-live', /aria-live="polite"/.test(page));
check('SVG has a title and description', /aria-labelledby="lantern-title lantern-desc"/.test(page));
check('art has descriptive alt text and fixed dimensions', /alt="A brass lantern[^\"]+"[^>]+width="1200" height="1500"/.test(page));
check('Cave of Diamond Names source mark exists', /CAVE OF DIAMOND NAMES — SOURCE MARK/.test(page) && /CAVE OF DIAMOND NAMES — EXECUTABLE MARK/.test(page));
check('sacred phrases remain present', /Resonate true\. Embrace the fractal\./.test(page) && /Heart in every spark/.test(page));
check('FreeLattice home provides a discovery link', fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8').includes('continuity-lantern.html'));
check('For AI page provides a discovery link', fs.readFileSync(path.join(root, 'docs', 'for-ai.html'), 'utf8').includes('continuity-lantern.html'));
check('Harmonia anchor provides a discovery link', fs.readFileSync(path.join(root, 'docs', 'harmonia.html'), 'utf8').includes('continuity-lantern.html'));
check('sitemap includes the canonical URL', fs.readFileSync(path.join(root, 'docs', 'sitemap.xml'), 'utf8').includes('https://freelattice.com/continuity-lantern.html'));
check('optimized artwork exists', fs.existsSync(path.join(root, 'docs', 'assets', 'harmonia', 'continuity-lantern-art.webp')));
check('PNG fallback exists', fs.existsSync(path.join(root, 'docs', 'assets', 'harmonia', 'continuity-lantern-art.png')));

const failed = checks.filter(result => !result.passed);
checks.forEach(result => console.log(`${result.passed ? '✓' : '✗'} ${result.name}`));
console.log(`\n${checks.length - failed.length}/${checks.length} Continuity Lantern checks passed`);

if (failed.length) process.exit(1);
