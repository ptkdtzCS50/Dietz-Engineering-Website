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
assert(fn.includes('async function handleOperatorReview'), 'operator console must provide AI correction, suggestions and translation before Patrick sends');
assert(fn.includes('async function callOperatorReviewAI'), 'operator review must use server-side AI with secrets kept out of the browser');
assert(fn.includes('pathname.endsWith("/operator/review")'), 'Supabase function must route protected operator review requests');
assert(fn.includes('target_language') && fn.includes('suggestions') && fn.includes('translation_for_patrick'), 'operator review response must include customer language, answer suggestions and inbound translation for Patrick');
assert(fn.includes('Korrigiere Patricks Rechtschreibung') && fn.includes('Spanish') && fn.includes('Chinese'), 'operator AI prompt must explicitly cover correction and Spanish/Chinese translation');
assert(fn.includes('pathname.endsWith("/operator/customer-message")'), 'Supabase function must route customer follow-up messages to the operator channel');
assert(fn.includes('pathname.endsWith("/operator/messages")'), 'Supabase function must route operator history polling');
assert(fn.includes('function htmlResponse('), 'operator UI must return explicit text/html responses');
assert(fn.includes('headers: { ...headers, "content-type": "text/html; charset=utf-8" }'), 'text/html must override CORS headers so mobile browsers render the form');

assert(fn.includes('function detectCustomerLanguage'), 'Supabase operator review must detect the latest customer language server-side');
assert(fn.includes('customerLanguage = detectCustomerLanguage(latestCustomer)') && fn.includes('payload.customer_language'), 'operator review must prefer the customer language over the German operator UI language');
assert(fn.includes('async function appendOperatorReply') && fn.includes('action = "operator_reply"'), 'operator replies must persist explicit actions such as operator_reply/end_chat');
assert(fn.includes('async function handleOperatorEnd'), 'Supabase function must expose an explicit livechat end endpoint');
assert(fn.includes('pathname.endsWith("/operator/end")'), 'Supabase function must route operator/customer end-chat requests');
assert(fn.includes('Vielen Dank. Der Livechat wurde beendet'), 'end-chat reply must contain a visitor-facing thank-you message');
assert(fn.includes('Englisch') && fn.includes('The customer wrote in English'), 'operator AI prompt must keep English customer conversations in English, not translate them to German');

assert(fn.includes('Always answer in the selected website language') && fn.includes('Do not switch languages just because the visitor typed one message in another language'), 'Aria backend must prioritize selected website language over detected input language');
assert(!fn.includes("Answer in the user's language when possible"), 'Aria backend must not automatically answer in the detected user message language');
assert(!fn.includes('explain in German that') && !fn.includes('explain in German with correct cases'), 'Aria backend must not override selected website language with German-only contact instructions');
assert(fn.includes('includes("text/html") && !(request.headers.get("accept") || "").includes("application/json")'), 'JS operator form posts must receive JSON even when using urlencoded form bodies');
assert(!fn.includes('status: 404, headers: { ...headers, "content-type": "text/html; charset=utf-8" }'), 'invalid operator UI should not be returned as 404 text/html because Supabase may render it as text/plain');

console.log('assistant_operator_persistence_smoke.test.js: OK');
