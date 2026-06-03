const fs = require('fs');
const path = require('path');

const root = __dirname;
const portalPath = path.join(root, 'src', 'customer-care.njk');
const indexPath = path.join(root, 'src', 'index.njk');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(fs.existsSync(portalPath), 'Customer Care portal source exists');

const portal = fs.readFileSync(portalPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');

assert(index.includes('/customer-care/'), 'main website links to the Customer Care portal');
assert(portal.includes('data-customer-care-portal'), 'portal has a stable Customer Care marker');
assert(portal.includes('data-pm-tool-design'), 'portal is explicitly aligned to the PM tool design');
assert(portal.includes('Customer Care Alerts'), 'portal prepares the Customer Care Telegram channel');
assert(portal.includes('const I18N='), 'portal has a dedicated translation dictionary');
assert(portal.includes('langSelectLogin') && portal.includes('langSelect'), 'portal exposes login and app language selectors');
assert(portal.includes('renderCareCompactCard'), 'portal carries PM-tool style compact review cards');
assert(portal.includes('data-care-next-click-hint'), 'portal includes PM-tool next-click microcopy');
assert(portal.includes('data-care-card-purpose'), 'portal includes PM-tool card-purpose microcopy');
assert(portal.includes('data-care-review-boundary'), 'portal includes PM-tool review boundary copy');

for (const lang of ['de', 'en', 'es', 'zh']) {
  assert(portal.includes(`${lang}:{`), `translation dictionary contains ${lang}`);
}

for (const role of ['customer', 'clarifier', 'fieldservice', 'admin']) {
  assert(portal.includes(`${role}:`), `role ${role} is defined`);
}

for (const status of [
  'new',
  'ai_triaged',
  'clarification_needed',
  'assigned',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
]) {
  assert(portal.includes(status), `ticket lifecycle contains ${status}`);
}

for (const trigger of ['production_stop', 'safety_risk', 'customer_requests_human']) {
  assert(portal.includes(trigger), `urgent trigger ${trigger} is represented`);
}

assert(portal.includes('aiRecommendationLimit:5'), 'AI recommendation limit defaults to five');
assert(portal.includes('slice(0,5)'), 'AI recommendations are capped at five in rendering/building');
assert(portal.includes('support-ticket-create'), 'Supabase support ticket function is planned');
assert(portal.includes('support-ai-triage'), 'Supabase AI triage function is planned');
assert(portal.includes('support-telegram-escalate'), 'Supabase Telegram escalation function is planned');

for (const table of [
  'profiles',
  'organizations',
  'organization_members',
  'support_tickets',
  'ticket_messages',
  'ticket_events',
  'ticket_attachments',
  'ticket_ai_assessments',
  'ticket_assignments',
  'telegram_escalations',
  'support_settings',
]) {
  assert(portal.includes(table), `Supabase table ${table} is prepared`);
}

assert(portal.includes('RLS: Kunden nur eigene Organisation'), 'portal documents the RLS boundary');
assert(portal.includes('Kontakt-, Vertrags- und Dateidaten'), 'portal separates sensitive customer data from AI triage');
assert(!/sk-[A-Za-z0-9_-]{20,}/.test(portal), 'portal contains no OpenAI secret');
assert(!/\b\d{8,12}:[A-Za-z0-9_-]{25,}\b/.test(portal), 'portal contains no Telegram bot token');

const scripts = [...portal.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
for (const script of scripts) {
  new Function(script);
}

console.log('customer_care_portal_smoke.test.js: OK');
