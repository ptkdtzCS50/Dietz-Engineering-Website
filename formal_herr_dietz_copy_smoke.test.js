const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/i18n.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'src/index.njk'), 'utf8');
const operatorPage = fs.readFileSync(path.join(root, 'src/operator-reply.njk'), 'utf8');
const assistantFunction = fs.readFileSync(path.join(root, 'supabase/functions/assistant/index.ts'), 'utf8');

const visibleGerman = JSON.stringify(i18n.de) + '\n' + index;
const forbiddenGermanCasual = [
  'Patrick direkt kontaktieren',
  'an Patrick Dietz übermittelt',
  'Patrick ist persönlich',
  'Patrick informieren',
  'Patrick kontaktieren',
  'Patrick übernimmt jetzt den Chat',
  'Patrick hat den Livechat beendet',
  'Falls Patrick nicht direkt verfügbar ist',
  'Übergabe an Patrick zu',
  'falls Patrick außerhalb dieses Chats antworten soll',
  'Patrick die Einordnung damit sauber übergeben',
];
for (const phrase of forbiddenGermanCasual) {
  assert(!visibleGerman.includes(phrase), `customer-facing German copy must use formal Herr/Herrn Dietz instead of: ${phrase}`);
}

assert(visibleGerman.includes('Herr Dietz kontaktieren'), 'German customer CTA should say Herr Dietz kontaktieren');
assert(visibleGerman.includes('Herr Dietz übernimmt jetzt den Chat'), 'German operator-active notice should be formal');
assert(visibleGerman.includes('Herr Dietz ist persönlich zwischen 08:00 und 17:00 Uhr erreichbar'), 'German availability notice should be formal');
assert(visibleGerman.includes('Übergabe an Herrn Dietz zu'), 'German consent example should be formal');
assert(visibleGerman.includes('Rückmeldung an Herrn Dietz'), 'German consent label should be formal');

assert(assistantFunction.includes('Herr Dietz prüft verbindliche Fragen persönlich.'), 'Supabase fallback/prompt copy should use Herr Dietz for customer-facing German status');
assert(!assistantFunction.includes('holen Sie Patrick über die Übergabe dazu'), 'Supabase fallback copy must not casually tell customers to bring in Patrick');

assert(operatorPage.includes('Nachricht von Herr Dietz') || operatorPage.includes('Nachricht von Herrn Dietz'), 'Operator page label should also present the sender formally');

for (const lang of ['de', 'en', 'es', 'zh']) {
  const customerFacing = Object.values(i18n[lang]).filter((_, index) => {
    const key = Object.keys(i18n[lang])[index];
    return key.startsWith('assistant.') || key === 'hero.tagline' || key === 'ct.p1';
  });
  assert(!JSON.stringify(customerFacing).includes('Patrick'), `${lang} assistant/CTA/hero copy should not use casual Patrick wording`);
}
assert(operatorPage.includes('Übersetzung für Herrn Dietz'), 'Operator translation label should also use Herr Dietz');
assert(!operatorPage.includes('Übersetzung für Patrick') && !operatorPage.includes('Patricks Antwort'), 'Operator page should not show casual Patrick labels');

console.log('formal_herr_dietz_copy_smoke.test.js: OK');
