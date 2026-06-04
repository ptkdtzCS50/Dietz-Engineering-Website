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
assert(config.includes('endpoint: "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant"'), 'public assistant endpoint points to the Supabase Aria assistant');
assert(config.includes('localDevEndpoint: "http://127.0.0.1:8790/assistant"'), 'local-only dev bridge endpoint remains available for localhost testing');
assert(config.includes('localProxyEndpoint: "http://127.0.0.1:8790/assistant"'), 'local-only proxy endpoint avoids browser CORS for remote AI tests');
assert(config.includes('remoteTestEndpoint: "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant"'), 'local-only remote test endpoint is available for Supabase handoff testing');
assert(config.includes('liveAiEnabled: true'), 'Aria is the primary live AI after Patrick approved the switch');
assert(config.includes('fallbackEnabled: true'), 'local fallback is enabled');
assert(config.includes('avatar: "aria-assistant-avatar.jpg"'), 'Aria avatar is part of the public assistant config');
assert(config.includes('handoffMode: "telegram_review"'), 'handoff mode targets Patrick review');
assert(config.includes('operatorChannel: "telegram_private_group"'), 'operator channel is a private Telegram group, not a broadcast channel');
assert(config.includes('availabilityTimezone: "Europe/Berlin"') && config.includes('availableFromHour: 8') && config.includes('availableUntilHour: 17'), 'Patrick live handoff is limited to 08:00-17:00 Europe/Berlin');
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
assert(index.includes('assistantLeadDetails') && index.includes('openAssistantLeadDetails'), 'assistant opens the visible details/consent area when handoff consent is missing');
assert(index.includes("const initialWantsPatrick = shouldRequestPatrickFromMessage(message)") && index.includes('const wantsPatrick = initialWantsPatrick') && !index.includes("shouldRequestPatrickFromMessage(message) || !guidedAssistantState.patrickNotified"), 'assistant only requests Patrick on explicit handoff intent, not every first message');
assert(index.includes('assistantConfig.localProxyEndpoint') && index.includes('if ((wantsRemoteAria || wantsLocalAria) && assistantConfig.endpoint) assistantConfig.liveAiEnabled = true;'), 'remote/local Aria test modes enable server-side AI chat through the localhost proxy when needed');
assert(index.includes("result.mode = 'ai_unavailable';") && index.includes("assistant.aiUnavailable"), 'remote AI/fallback answers are shown as unavailable instead of local static prompts');
assert(index.includes('messages: guidedAssistantState.chatHistory.length'), 'remote AI receives recent chat history instead of a single static prompt only');
assert(index.includes('function hasAssistantHandoffConsent(') && index.includes('function requireAssistantHandoffConsent('), 'all Patrick/Telegram handoff paths have a shared consent guard');
assert(index.includes('function applyChatHandoffConsentFromMessage(') && index.includes('appendHandoffQuickActions'), 'chat can capture explicit handoff consent and render quick-action buttons');
assert(index.includes('Name: Patrick Test') || index.includes('Thema: Schaltschrankumbau') || index.includes('topicMatch'), 'chat parser supports structured name/topic handoff details');
assert(index.includes("if (guidedAssistantState.ariaActive && !wantsPatrick)") && !index.includes("guidedAssistantState.ariaActive && !shouldRequestPatrickFromMessage(message)"), 'chat-level consent/Pattrick handoff intent is not swallowed by active Aria follow-up mode');
assert(index.includes('function getAssistantHandoffMissing(') && index.includes('function askForChatHandoffDetails(') && index.includes('function startPatrickHandoffFromChat('), 'handoff is a chat-first slot-filling flow before Telegram notification');
assert(index.includes('assistant-ai-consent') && index.includes('OpenAI') && index.includes('dietz_aria_openai_consent_v1'), 'chat shows OpenAI processing consent gate before AI input');
assert(index.includes('assistant.aiConsentNotice') && index.includes('assistant.aiConsentAccept') && index.includes('assistant.aiConsentDecline'), 'AI consent gate uses translated i18n keys instead of hardcoded copy');
assert(index.includes('data-i18n="assistant.aiConsentNotice" data-i18n-html') && index.includes('data-i18n="assistant.aiConsentAccept"') && index.includes('data-i18n="assistant.aiConsentDecline"'), 'AI consent notice and buttons are wired to runtime translation');
assert(index.includes('data-consent-gated-greeting="true"') && index.includes('function appendAssistantGreetingAfterConsent('), 'Aria greeting is appended only after AI consent is accepted/restored');
assert(!index.includes('<div class="assistant-chat-bubble assistant-chat-bubble-aria" data-i18n="assistant.greeting">'), 'Aria greeting is not pre-rendered before the AI consent gate');
assert(/Herrn? Dietz/.test(i18n.de['assistant.greeting']) && !i18n.de['assistant.greeting'].includes('Patrick vorbereiten') && i18n.de['assistant.greeting'].length < 150, 'German Aria greeting is formal, positive about Herr Dietz, and concise after AI consent');
assert(index.includes('function appendAssistantStartQuestions(') && index.includes('assistant.startQuestionServices') && index.includes('assistant.startQuestionEplan') && index.includes('assistant.startQuestionProcess'), 'Aria shows three frequent-question starter buttons after AI consent');
assert(index.includes('assistant-start-questions') && index.includes('handleAssistantChatSend()'), 'starter question buttons inject the selected question into the chat flow');
assert(!index.includes("appendChatMessage('aria', assistantDict()['assistant.aiConsentStarted']);"), 'accepting AI consent does not add an extra second start sentence');
assert(index.includes('assistant.handoffPrivacyNotice') && JSON.stringify(i18n.de).includes('maximal 7 Tage') && JSON.stringify(i18n.de).includes('spätestens nach 7 Tagen'), 'handoff flow explains seven-day storage before sending contact data to Patrick');
const assistantCopy = Object.fromEntries(Object.entries(i18n.de).filter(([key]) => key.startsWith('assistant.')));
assert(!/Projektdateien|project files|archivos confidenciales|保密项目文件/i.test(index + JSON.stringify(assistantCopy)), 'assistant copy does not warn specifically about project documents/files in chat');
assert(index.includes('let assistantTypingQueue = Promise.resolve()') && index.includes('function typeAssistantBubble(') && index.includes('prefers-reduced-motion'), 'Aria replies are typed sequentially instead of appearing instantly');
assert(index.includes('assistant-panel-open') && index.includes('document.body.classList.add(\'assistant-panel-open\')') && index.includes('document.body.classList.remove(\'assistant-panel-open\')'), 'mobile assistant open state locks page scroll and lets the panel own scrolling');
assert(index.includes('100dvh') && index.includes('-webkit-overflow-scrolling: touch') && index.includes('body.assistant-panel-open .assistant-launcher'), 'mobile assistant panel uses dynamic viewport height, native inner scrolling, and hides the launcher while open');
assert(index.includes('.assistant-panel {') && index.includes('z-index: 140;') && index.includes('.assistant-launcher {') && index.includes('z-index: 139;'), 'assistant overlay stays above the fixed mobile navigation so its header is not clipped');
assert(index.includes('assistant-fieldless-hidden') && index.includes('assistant-lead-details assistant-fieldless-hidden'), 'legacy lower assistant menu/details are hidden for chat-first UX');
assert(index.includes('const handoffIntentText = /(?:weitergabe|weiterleiten|übergabe|uebergabe|kontaktaufnahme') && index.includes('const wantsPatrick = initialWantsPatrick || chatConsentGiven'), 'explicit chat consent immediately triggers handoff instead of another AI answer');
assert(index.includes('appendPatrickContactAction()') && !index.includes('Für die Übergabe können Sie die Angaben direkt hier im Chat senden'), 'normal AI answers should offer a non-pushy Patrick contact button instead of repeatedly asking for contact details');
assert(index.includes('if (!hasAssistantHandoffConsent()) return { ok: false, skipped: true, reason: \'consent_required\' };'), 'lead endpoint call is blocked before consent');
assert(!index.includes('<body data-chatbase-live="enabled">'), 'production page no longer hides Aria behind Chatbase by default');
assert(index.includes('params.get(\'chatbase\')===\'fallback\'') && index.includes('https://www.chatbase.co/embed.min.js'), 'Chatbase remains available only as explicit fallback override');
assert(index.includes('document.body.dataset.ariaPrimary = \'enabled\''), 'production marks Aria as the primary assistant');
assert(index.includes('function isPatrickLiveHandoffAvailable(') && index.includes('function appendContactFormAction('), 'assistant checks Patrick availability and can show a contact-form action');
assert(index.includes("availabilityTimezone: 'Europe/Berlin'") && index.includes("availableFromHour: 8") && index.includes("availableUntilHour: 17"), 'assistant default availability is 08:00-17:00 Europe/Berlin');
assert(index.includes("window.location.hash = 'booking'") && index.includes("assistant.outOfHoursContact"), 'after-hours Patrick requests route users to the contact form');
const contactFormActionSegment = index.slice(index.indexOf('function appendContactFormAction('), index.indexOf('function handleOutOfHoursPatrickRequest('));
assert(contactFormActionSegment.includes('closeAssistant();') && contactFormActionSegment.indexOf('closeAssistant();') < contactFormActionSegment.indexOf("window.location.hash = 'booking'"), 'mobile contact-form CTA closes the assistant overlay before routing to the booking form');
assert(index.includes("guidedAssistantState.outOfHoursNoticeShown") && index.includes('guidedAssistantState.takeoverRequested = false;'), 'after-hours contact notice is non-sticky so later technical questions continue as Aria chat');
assert(index.includes("if (!isPatrickLiveHandoffAvailable())") && index.includes("appendContactFormAction()"), 'live Telegram handoff is blocked outside Patrick availability window');
assert(index.includes('document.body.dataset.ariaLocalTest') && index.includes("ariaTestMode === 'remote'"), 'local website can expose Aria for remote Supabase handoff tests');
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
  assert(i18n[lang]['assistant.aiConsentNotice'] && i18n[lang]['assistant.aiConsentAccept'] && i18n[lang]['assistant.aiConsentDecline'], `${lang} AI processing consent copy exists`);
}

assert(fs.existsSync(functionPath), 'Supabase assistant handoff function is prepared');
const fn = fs.readFileSync(functionPath, 'utf8');
assert(fn.includes('function assistantAiEnabled()') && fn.includes('!== "false"'), 'server function enables live AI when OPENAI_API_KEY exists unless ASSISTANT_ENABLED=false explicitly disables it');
assert(fn.includes('TELEGRAM_BOT_TOKEN') && fn.includes('TELEGRAM_CHAT_ID'), 'server function supports Telegram delivery via env only');
assert(fn.includes('Operator-Kanal: private Telegram-Gruppe'), 'Telegram handoff is documented as private group operator channel');
assert(fn.includes('Status: Herr-Dietz-Review angefordert'), 'Telegram handoff uses operator status instead of a rigid auto-answer');
assert(!fn.includes('Aria-Antwort:'), 'Telegram handoff must not include a canned Aria auto-answer');
assert(fn.includes('OPENAI_API_KEY'), 'server function supports server-side OpenAI key only');
assert(fn.includes('redactContactData') && fn.includes('sanitizePayloadForAi'), 'server strips contact data before any external AI call');
assert(fn.includes('[redacted-email]') && fn.includes('[redacted-phone]') && fn.includes('[redacted-company]'), 'AI sanitizer redacts email, phone and company markers');
assert(fn.includes('const aiPayload = sanitizePayloadForAi(payload);'), 'OpenAI call uses sanitized payload only');
assert(!fn.includes('contextPrompt(payload.context || {})'), 'OpenAI call must not use raw context');
assert(!fn.includes('...normalizeMessages(payload),'), 'OpenAI call must not use raw messages');
assert(fn.includes('rateLimit'), 'server function has basic rate-limit guard');
assert(fn.includes('payload.confirmed !== true') && fn.includes('handoff requires confirmed consent'), 'server lead endpoint requires explicit confirmed consent');
assert(fn.includes('isOriginAllowed') && fn.includes('DEFAULT_ALLOWED_ORIGINS') && !fn.includes('origin || "*"'), 'server function uses a hard CORS allowlist fallback');
assert(fn.includes('fallback_reason'), 'server function returns fallback reason on limit/API problems');
assert(fn.includes('assistantDiagnostic') && fn.includes('has_openai_key') && fn.includes('fallbackReasonForError'), 'server function returns non-secret diagnostics for AI fallback causes');
assert(fn.includes('function unavailableReply') && fn.includes('mode: "ai_unavailable"'), 'server chat returns AI-unavailable instead of static fallback when model access fails');
assert(fn.includes('Herr Dietz prüft verbindliche Fragen persönlich'), 'server function keeps formal Herr Dietz review boundary');
assert(fn.includes('Never invent email addresses') && fn.includes('official website contact details'), 'server prompt forbids fake contact details and invented email addresses');
assert(fn.includes('customer-facing German answers formally as Herr Dietz') && fn.includes('Ja, Herr Dietz kann EPLAN-/Makro-Themen'), 'server-side Aria answers speak formally and positively about Herr Dietz');
assert(fn.includes('Do not store or imply persistent visitor chat memory') && fn.includes('durable knowledge is curated DIETZ requirements'), 'server prompt separates durable curated knowledge from persistent chat memory');
assert(fn.includes('Do not say you cannot contact Herr Dietz directly') && fn.includes('private Telegram operator channel'), 'server prompt aligns Aria handoff wording with the configured Telegram operator channel');
assert(fn.includes('operatorSessions') && fn.includes('handleOperatorReply') && fn.includes('handleReplies'), 'server function exposes production operator reply polling instead of routing Patrick replies back into AI chat');
assert(fn.includes('session_id') && fn.includes('operator_token') && fn.includes('operatorPublicUiUrl'), 'handoff response includes session id and protected public operator UI link for Patrick replies');
assert(fn.includes('POST, GET, OPTIONS'), 'CORS allows website reply polling GET requests');
assert(fn.includes('Do not promise a callback time') && fn.includes('concrete response time'), 'server prompt forbids binding callback promises');
assert(!/patrick\.dietz@elektroengineering\.de/i.test(fn + index + JSON.stringify(i18n)), 'assistant must not contain the previously invented email address');
assert(!/sk-[A-Za-z0-9_-]{20,}/.test(fn), 'server function contains no OpenAI secret');
assert(!/\b\d{8,12}:[A-Za-z0-9_-]{25,}\b/.test(fn), 'server function contains no Telegram bot token');

console.log('assistant_hybrid_contract_smoke.test.js: OK');
