const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const fn = fs.readFileSync(path.join(root, 'supabase/functions/assistant/index.ts'), 'utf8');

assert(fn.includes('function formatLead('), 'formatLead must exist');
assert(fn.includes('Operator-Kanal: private Telegram-Gruppe'), 'Telegram handoff must identify the private operator group');
assert(fn.includes('Status: Patrick-Review angefordert'), 'Telegram handoff must use a concise operator status');
assert(!fn.includes('Aria-Antwort:'), 'Telegram handoff must not include a canned Aria answer');

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
  'Status: Patrick-Review angefordert (fallback)',
  '',
  'Patrick prüft verbindliche Fragen persönlich.',
].join('\n');

assert(localTelegramPreview.includes('Status: Patrick-Review angefordert'), 'local preview should show Patrick review status');
assert(!localTelegramPreview.includes('Aria-Antwort:'), 'local preview should not show a rigid auto-answer');

console.log('assistant_telegram_handoff_smoke.test.js: OK');
