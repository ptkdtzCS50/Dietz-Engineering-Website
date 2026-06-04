const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const page = fs.readFileSync(path.join(root, 'src/operator-reply.njk'), 'utf8');

assert(page.includes('<title>DIETZ Operator Antwort</title>'), 'operator reply page must have the expected title');
assert(page.includes('action="https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant/operator/reply"'), 'operator reply page must post to the Supabase operator reply endpoint');
assert(page.includes('new URLSearchParams(window.location.search)'), 'operator reply page must read protected query parameters from the Telegram link');
assert(page.includes('name="session_id"') && page.includes('name="operator_token"'), 'operator reply page must forward session id and operator token');
assert(page.includes('Der Antwort-Link ist unvollständig'), 'operator reply page must show a clear notice for incomplete links');

console.log('operator_reply_page_smoke.test.js: OK');
