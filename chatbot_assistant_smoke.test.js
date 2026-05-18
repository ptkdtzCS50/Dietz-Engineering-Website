const fs = require('fs');
const path = require('path');

const root = __dirname;
const index = fs.readFileSync(path.join(root, 'src', 'index.njk'), 'utf8');
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/i18n.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(index.includes('AI ASSISTANT PREVIEW'), 'assistant CSS/HTML/JS marker exists');
assert(index.includes('id="assistantLauncher"'), 'assistant launcher exists');
assert(index.includes('id="assistantPanel"'), 'assistant panel exists');
assert(index.includes('Noch kein Live-KI-Chat'), 'local-only/no-live-ai copy is visible');
assert(index.includes('buildAssistantSummary'), 'deterministic triage summary function exists');
assert(index.includes('textarea[name="project"]'), 'assistant targets existing booking project textarea');
assert(index.includes('missing_information'), 'assistant records missing-information queue');
assert(index.includes('Keine vertraulichen Kundendaten'), 'confidentiality warning exists');
assert(index.includes('stats-intro'), 'stats intro prevents abrupt transition into metrics');
assert(index.includes('trust-intro'), 'trust intro prevents abrupt transition into industries/tools');
assert(index.includes('html[lang="es"] .section-label'), 'Spanish labels are not forced into wide uppercase');
assert(index.includes('window.__dietzThemeBound'), 'theme toggle is bootstrapped independently before lower feature scripts');
assert(index.includes('if (!window.__dietzThemeBound && themeToggle)'), 'lower theme script does not double-bind the toggle');
assert(index.includes('width: min(100%, 2172px);'), 'hero banner is not upscaled beyond native width');
assert(index.includes('[data-theme="light"] .privacy-backdrop'), 'privacy overlay stays light in light mode');
assert(i18n.en['sit.title'].includes('Still unsure'), 'English project-situations title reframes need-fit question');
assert(i18n.en['sit.subtitle'].includes('If one of these situations'), 'English project-situations subtitle explains when support fits');

const forbidden = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'claude.ai',
  'fetch(\'/chat',
  'fetch("/chat',
  'fetch(`/chat'
];
for (const marker of forbidden) {
  assert(!index.includes(marker), `no live AI/backend endpoint in static v0: ${marker}`);
}

for (const lang of ['de', 'en', 'es', 'zh']) {
  assert(i18n[lang]['pv.cat2Desc'] && !i18n[lang]['pv.cat2Desc'].includes('Google-CDN'), `${lang} privacy font text no longer claims Google CDN`);
  assert(i18n[lang]['pv.cat4Desc'] && /Google|Calendar|日历/.test(i18n[lang]['pv.cat4Desc']), `${lang} privacy calendar text exists`);
}

console.log('chatbot_assistant_smoke.test.js: OK');
