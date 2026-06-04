const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const page = fs.readFileSync(path.join(root, 'src/operator-reply.njk'), 'utf8');

assert(page.includes('<title>DIETZ Operator Antwort</title>'), 'operator reply page must have the expected title');
assert(page.includes('action="https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant/operator/reply"'), 'operator reply page must post to the Supabase operator reply endpoint');
assert(page.includes('const ASSISTANT_ENDPOINT = "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant"'), 'operator reply page must know the Supabase assistant endpoint for protected history polling');
assert(page.includes('id="operatorTimeline"') && page.includes('data-operator-console'), 'operator reply page must render a DIETZ-styled operator console with chat history');
assert(page.includes('/operator/messages?') && page.includes('pollOperatorTimeline'), 'operator reply page must poll visitor/operator chat history');
assert(page.includes('dietz-shell') && page.includes('Dietz Engineering'), 'operator reply page must use the DIETZ website design language, not a raw standalone form');
assert(page.includes('new URLSearchParams(window.location.search)'), 'operator reply page must read protected query parameters from the Telegram link');
assert(page.includes('name="session_id"') && page.includes('name="operator_token"'), 'operator reply page must forward session id and operator token');
assert(page.includes('Der Antwort-Link ist unvollständig'), 'operator reply page must show a clear notice for incomplete links');

console.log('operator_reply_page_smoke.test.js: OK');
