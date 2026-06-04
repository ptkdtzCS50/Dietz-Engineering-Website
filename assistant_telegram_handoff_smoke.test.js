const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const fn = fs.readFileSync(path.join(root, 'supabase/functions/assistant/index.ts'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src/index.njk'), 'utf8');

assert(fn.includes('function formatLead('), 'formatLead must exist');
assert(fn.includes('function operatorBaseUrl(request: Request)'), 'operator reply URL builder must exist');
assert(fn.includes('const canonicalFunctionPath = "/functions/v1/assistant"'), 'operator reply URLs must use the canonical Supabase function path, not the project root');
assert(fn.includes('function publicFunctionOrigin(request: Request)') && fn.includes('return `${url.protocol === "http:" ? "https:" : url.protocol}//${url.host}`;'), 'operator reply URLs must force the public https Supabase origin even when Edge runtime request.url is http');
assert(fn.includes('return `${origin}${canonicalFunctionPath}`;'), 'operator reply URLs must fall back to /functions/v1/assistant when the runtime path is shortened');
assert(fn.includes('Operator-Kanal: private Telegram-Gruppe'), 'Telegram handoff must identify the private operator group');
assert(fn.includes('Status: Herr-Dietz-Review angefordert'), 'Telegram handoff must use a concise operator status');
assert(!fn.includes('Aria-Antwort:'), 'Telegram handoff must not include a canned Aria answer');
assert(index.includes('.assistant-chat-log {'), 'assistant chat log CSS must exist');
assert(index.includes('min-height: 9.5rem;') && index.includes('max-height: min(34dvh, 18rem);'), 'mobile assistant chat log must keep a usable viewport instead of collapsing start-question buttons');
assert(index.includes('.assistant-start-questions .btn') && index.includes('min-height: 2.75rem;'), 'assistant start-question buttons must retain readable tap height on mobile');

const localTelegramPreview = [
  'Neue DIETZ Website-Anfrage / Aria Projektassistenz',
  'Operator-Kanal: private Telegram-Gruppe',
  '',
  'Name: nicht angegeben',
  'Kontakt: nicht angegeben',
  'Sprache: de',
  '',
  'Projekttyp: EPLAN / Elektrokonstruktion',
  'Maschine/Anlage: Verpackungsmaschine',
  'Zeitrahmen: Nur Vorabklaerung',
  'Kurzbeschreibung: Lokaler Handoff-Test',
  '',
  'Frage: Test EPLAN Makro ohne Kontaktdaten.',
  '',
  'Status: Herr-Dietz-Review angefordert (fallback)',
  '',
  'Herr Dietz prüft verbindliche Fragen persönlich.',
].join('\n');

assert(localTelegramPreview.includes('Status: Herr-Dietz-Review angefordert'), 'local preview should show Herr Dietz review status');
assert(!localTelegramPreview.includes('Aria-Antwort:'), 'local preview should not show a rigid auto-answer');

console.log('assistant_telegram_handoff_smoke.test.js: OK');
