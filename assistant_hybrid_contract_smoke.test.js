const fs = require('fs');
const path = require('path');

const root = __dirname;
const index = fs.readFileSync(path.join(root, 'src', 'index.njk'), 'utf8');
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/i18n.json'), 'utf8'));
const configPath = path.join(root, 'src/static/assistant-config.js');
const functionPath = path.join(root, 'supabase/functions/assistant/index.ts');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(fs.existsSync(configPath), 'assistant config passthrough file exists');
const config = fs.readFileSync(configPath, 'utf8');
assert(config.includes('window.DIETZ_ASSISTANT_CONFIG'), 'browser config exposes namespaced DIETZ assistant config');
assert(config.includes('mode: "hybrid"'), 'assistant default mode is hybrid');
assert(config.includes('endpoint: ""'), 'public assistant endpoint is empty by default');
assert(config.includes('localDevEndpoint: "http://127.0.0.1:8790/assistant"'), 'local-only dev bridge endpoint remains available for localhost testing');
assert(config.includes('liveAiEnabled: false'), 'live AI is disabled by default until Patrick approves deployment');
assert(config.includes('fallbackEnabled: true'), 'local fallback is enabled');
assert(config.includes('avatar: "aria-assistant-avatar.jpg"'), 'Aria avatar is part of the public assistant config');
assert(config.includes('handoffMode: "telegram_review"'), 'handoff mode targets Patrick review');
assert(!/sk-[A-Za-z0-9_-]{20,}/.test(config), 'config contains no OpenAI secret');
assert(!/\b\d{8,12}:[A-Za-z0-9_-]{25,}\b/.test(config), 'config contains no Telegram bot token');

assert(index.includes('/assistant-config.js'), 'static site loads assistant config before assistant behavior');
assert(index.includes('DIETZ_ASSISTANT_KNOWLEDGE'), 'browser assistant carries DIETZ knowledge basis');
assert(index.includes('EPLAN P8') && index.includes('Makro') && index.includes('Schaltschrank'), 'knowledge basis includes EPLAN, macros and cabinet topics');
assert(index.includes('review_required_personal_patrick'), 'assistant marks personal-review cases explicitly');
assert(index.includes('token_or_endpoint_fallback'), 'assistant has token/API fallback marker');
assert(index.includes('assistantChatInput'), 'assistant includes free-form customer question input');
assert(index.includes('assistant.send'), 'assistant includes send action for live chat');
assert(index.includes('assistant.confirm'), 'assistant includes handoff/confirm action');
assert(index.includes('assistant.localFallbackNotice'), 'assistant shows local fallback notice');
assert(index.includes('assistant.emptyQuestionPrompt'), 'assistant gives a useful prompt when no question/details are entered');
assert(!index.includes('assistant.liveDisabledNotice'), 'assistant does not render dead/live-disabled copy on the website');
assert(index.includes('assistantConsent') && index.includes('assistant.consentRequired'), 'assistant requires explicit consent before Patrick/Telegram handoff');
assert(index.includes('assistant.consentLabel'), 'assistant handoff consent text is translated');
assert(index.includes('function hasAssistantHandoffConsent(') && index.includes('function requireAssistantHandoffConsent('), 'all Patrick/Telegram handoff paths have a shared consent guard');
assert(index.includes('if (!hasAssistantHandoffConsent()) return { ok: false, skipped: true, reason: \'consent_required\' };'), 'lead endpoint call is blocked before consent');
assert(index.includes('https://www.chatbase.co/embed.min.js') && index.includes('data-chatbase-live="enabled"'), 'production page intentionally loads Chatbase live assistant');
const chatCallSegment = index.slice(index.indexOf('async function callAssistantEndpoint'), index.indexOf('async function sendAssistantLead'));
assert(!chatCallSegment.includes('assistantContactName') && !chatCallSegment.includes('assistantContactContact'), 'normal chat call does not send contact details before confirmed handoff');

for (const lang of ['de', 'en', 'es', 'zh']) {
  assert(i18n[lang]['assistant.question'], `${lang} question label exists`);
  assert(i18n[lang]['assistant.ask'], `${lang} ask label exists`);
  assert(i18n[lang]['assistant.confirm'], `${lang} confirm label exists`);
  assert(i18n[lang]['assistant.localFallbackNotice'], `${lang} local fallback notice exists`);
  assert(i18n[lang]['assistant.emptyQuestionPrompt'], `${lang} empty prompt copy exists`);
  assert(i18n[lang]['assistant.trustEplanMacro'], `${lang} EPLAN macro trust answer exists`);
  assert(i18n[lang]['assistant.boundaryNoGuarantee'], `${lang} guarantee boundary exists`);
  assert(i18n[lang]['assistant.consentLabel'] && i18n[lang]['assistant.consentRequired'], `${lang} consent copy exists`);
}

assert(fs.existsSync(functionPath), 'Supabase assistant handoff function is prepared');
const fn = fs.readFileSync(functionPath, 'utf8');
assert(fn.includes('ASSISTANT_ENABLED') && fn.includes('false'), 'server function defaults disabled for live AI');
assert(fn.includes('TELEGRAM_BOT_TOKEN') && fn.includes('TELEGRAM_CHAT_ID'), 'server function supports Telegram delivery via env only');
assert(fn.includes('OPENAI_API_KEY'), 'server function supports server-side OpenAI key only');
assert(fn.includes('rateLimit'), 'server function has basic rate-limit guard');
assert(fn.includes('payload.confirmed !== true') && fn.includes('handoff requires confirmed consent'), 'server lead endpoint requires explicit confirmed consent');
assert(fn.includes('isOriginAllowed') && fn.includes('DEFAULT_ALLOWED_ORIGINS') && !fn.includes('origin || "*"'), 'server function uses a hard CORS allowlist fallback');
assert(fn.includes('fallback_reason'), 'server function returns fallback reason on limit/API problems');
assert(fn.includes('Patrick prüft verbindliche Fragen persönlich'), 'server function keeps Patrick review boundary');
assert(!/sk-[A-Za-z0-9_-]{20,}/.test(fn), 'server function contains no OpenAI secret');
assert(!/\b\d{8,12}:[A-Za-z0-9_-]{25,}\b/.test(fn), 'server function contains no Telegram bot token');

console.log('assistant_hybrid_contract_smoke.test.js: OK');
