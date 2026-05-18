const fs = require('fs');
const path = require('path');

const root = __dirname;
const index = fs.readFileSync(path.join(root, 'src', 'index.njk'), 'utf8');
const renderedIndexPath = path.join(root, '_site', 'index.html');
const renderedIndex = fs.existsSync(renderedIndexPath) ? fs.readFileSync(renderedIndexPath, 'utf8') : index;
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/i18n.json'), 'utf8'));
const { execFileSync } = require('child_process');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(index.includes('AI ASSISTANT PREVIEW'), 'assistant CSS/HTML/JS marker exists');
assert(index.includes('id="assistantLauncher"'), 'assistant launcher exists');
assert(index.includes('id="assistantPanel"'), 'assistant panel exists');
assert(index.includes('Projektanfrage strukturiert vorbereiten'), 'production assistant copy is visible');
assert(index.includes('buildAssistantSummary'), 'deterministic triage summary function exists');
assert(index.includes('textarea[name="project"]'), 'assistant targets existing booking project textarea');
assert(index.includes('missing_information'), 'assistant records missing-information queue');
assert(index.includes('Keine vertraulichen Kundendaten'), 'confidentiality warning exists');
assert(index.includes("#bookingForm textarea[name=\"project\"], textarea[name=\"project\"]"), 'assistant targets the booking project textarea robustly');
assert(index.includes("projectField.dispatchEvent(new Event('input', { bubbles: true }))"), 'assistant notifies the form after autofilling project text');
assert(index.includes('pkgField.value = selectedType'), 'assistant transfers selected project type into the package field');
assert(index.includes('stats-intro'), 'stats intro prevents abrupt transition into metrics');
assert(index.includes('trust-intro'), 'trust intro prevents abrupt transition into industries/tools');
assert(index.includes('html[lang="es"] .section-label'), 'Spanish labels are not forced into wide uppercase');
assert((index.match(/function buildAssistantSummary\(\)/g) || []).length === 1, 'assistant script exists exactly once');
assert((index.match(/\.assistant-launcher \{\n  position: fixed;/g) || []).length === 1, 'assistant CSS exists exactly once');
assert(index.includes('window.__dietzThemeBound'), 'theme toggle is bootstrapped independently before lower feature scripts');
assert(index.includes('[data-theme="light"] .privacy-backdrop'), 'privacy overlay stays light in light mode');
assert(index.includes('width: min(100%, 2172px);'), 'hero banner is not upscaled beyond native width');
assert(index.includes("document.querySelectorAll('.fade').forEach(el => el.classList.add('in'))"), 'fade sections are made visible immediately after JS boot');
assert(i18n.en['sit.title'].includes('Still unsure'), 'English project-situations title reframes need-fit question');
assert(i18n.en['sit.subtitle'].includes('If one of these situations'), 'English project-situations subtitle explains when support fits');

const forbidden = [
  'Noch kein Live-KI-Chat',
  'DIETZ Assistent · Vorschau',
  'stellt erste technische Fragen',
  'KI-Backend',
  'Cloudflare Worker',
  'clients who run without me',
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

for (const [lang, forbiddenPattern] of [
  ['de', /\b(Wir|wir)\b/],
  ['en', /\b(We|we|We'll|we'll|our|Our)\b/],
  ['es', /\b(Hablaremos|hablaremos|Definimos)\b/],
  ['zh', /我们/]
]) {
  for (const key of ['bk.introLine', 'bk.consultIntro']) {
    assert(!forbiddenPattern.test(i18n[lang][key] || ''), `${lang} ${key} avoids team-implying wording`);
  }
}

const executableScripts = [...renderedIndex.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert(executableScripts.length >= 2, 'executable scripts exist for early theme and main behavior');
for (const [scriptIndex, script] of executableScripts.entries()) {
  const tempPath = path.join('/tmp', `dietz-website-script-${scriptIndex}.js`);
  fs.writeFileSync(tempPath, script);
  try {
    execFileSync('node', ['--check', tempPath], { stdio: 'pipe' });
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    assert(false, `generated executable script ${scriptIndex} has valid JavaScript syntax`);
  }
}

console.log('chatbot_assistant_smoke.test.js: OK');
