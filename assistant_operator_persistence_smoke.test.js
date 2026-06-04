const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const fn = fs.readFileSync(path.join(root, 'supabase/functions/assistant/index.ts'), 'utf8');

assert(fn.includes('function publicFunctionOrigin(request: Request)'), 'operator links must normalize Supabase internal http origins to public https origins');
assert(fn.includes('return `${url.protocol === "http:" ? "https:" : url.protocol}//${url.host}`;'), 'operator URLs must be generated with https on the public Supabase host');
assert(fn.includes('async function saveOperatorSession'), 'operator sessions must be persisted outside per-isolate memory');
assert(fn.includes('async function loadOperatorSession'), 'operator UI/reply must load sessions from durable storage');
assert(fn.includes('function operatorPublicUiUrl') && fn.includes('https://dietz-engineering.com/operator-reply/'), 'Telegram reply links must open a normal website HTML page instead of Supabase GET HTML');
assert(fn.includes('assistant_operator_sessions'), 'operator sessions must use the Supabase database table');
assert(fn.includes('assistant_operator_replies'), 'operator replies must use the Supabase database table');
assert(fn.includes('assistant_operator_messages'), 'customer/operator chat history must use a dedicated Supabase database table so customer follow-ups are visible to Patrick without echoing back to the visitor');
assert(fn.includes('async function appendOperatorMessage'), 'operator console must persist both visitor and Patrick messages for chat history');
assert(fn.includes('async function handleOperatorMessages'), 'operator console must expose a protected polling endpoint for chat history');
assert(fn.includes('async function handleCustomerMessage'), 'website visitor follow-up messages must be accepted after Patrick takes over');
assert(fn.includes('pathname.endsWith("/operator/customer-message")'), 'Supabase function must route customer follow-up messages to the operator channel');
assert(fn.includes('pathname.endsWith("/operator/messages")'), 'Supabase function must route operator history polling');
assert(fn.includes('function htmlResponse('), 'operator UI must return explicit text/html responses');
assert(fn.includes('headers: { ...headers, "content-type": "text/html; charset=utf-8" }'), 'text/html must override CORS headers so mobile browsers render the form');
assert(fn.includes('includes("text/html") && !(request.headers.get("accept") || "").includes("application/json")'), 'JS operator form posts must receive JSON even when using urlencoded form bodies');
assert(!fn.includes('status: 404, headers: { ...headers, "content-type": "text/html; charset=utf-8" }'), 'invalid operator UI should not be returned as 404 text/html because Supabase may render it as text/plain');

console.log('assistant_operator_persistence_smoke.test.js: OK');
