const fs = require('fs');
const path = require('path');

const root = __dirname;
const index = fs.readFileSync(path.join(root, 'src', 'index.njk'), 'utf8');
const renderedIndexPath = path.join(root, '_site', 'index.html');
const renderedIndex = fs.existsSync(renderedIndexPath) ? fs.readFileSync(renderedIndexPath, 'utf8') : index;
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/i18n.json'), 'utf8'));
const { execFileSync } = require('child_process');
const pythonBin = process.env.PYTHON_BIN || 'python3';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(index.includes('ARIA WEBSITE ASSISTANT'), 'assistant CSS/HTML/JS marker exists as a real Aria website assistant, not preview copy');
assert(index.includes('id="assistantLauncher"'), 'assistant launcher exists');
assert(index.includes('id="assistantPanel"'), 'assistant panel exists');
assert(!index.includes('<body data-chatbase-live="enabled">'), 'Chatbase is not marked as live on the production page by default');
assert(index.includes('jjukctX1wFEHC5Dh01_ND') && index.includes('https://www.chatbase.co/embed.min.js'), 'Chatbase fallback widget embed remains installed');
assert(index.includes('body[data-chatbase-live="enabled"] .assistant-launcher') && index.includes('body[data-chatbase-live="enabled"] .assistant-panel'), 'explicit Chatbase fallback mode hides the in-house Aria widget to avoid double chat launchers');
assert(index.includes('body[data-aria-local-test="enabled"] .assistant-launcher') && index.includes('body[data-aria-local-test="enabled"] .assistant-panel.open'), 'local Aria test mode can show the in-house assistant while Chatbase is disabled');
assert(index.includes("const wantsRemoteAria = ariaTestMode === 'remote'") && index.includes('assistantConfig.remoteTestEndpoint'), 'local website can route Aria to the Supabase test endpoint with ?aria=remote');
assert(index.includes('assistantConfig.localProxyEndpoint') && index.includes('isLocalAssistantHost'), 'localhost ?aria=remote uses the local proxy to avoid browser CORS blocking live AI tests');
assert(index.includes('else if (wantsLocalAria && assistantConfig.localDevEndpoint) assistantConfig.endpoint = assistantConfig.localDevEndpoint;'), 'localhost/local Aria mode prefers the local dev bridge even though production endpoint is configured');
assert(index.includes('if ((wantsRemoteAria || wantsLocalAria) && assistantConfig.endpoint) assistantConfig.liveAiEnabled = true;'), '?aria=remote/local enables live AI chat instead of static-only replies');
assert(index.includes("params.get('chatbase')==='fallback'") && index.includes('useChatbaseFallback'), 'Chatbase loader is skipped unless explicit fallback mode is requested');
assert(index.includes('aria-assistant-avatar.jpg'), 'Aria assistant avatar image is embedded in the website assistant');
assert(index.includes('class="assistant-avatar"'), 'assistant header contains a personal avatar block');
assert(index.includes('Direkt mit DIETZ Engineering chatten'), 'production assistant copy is visible');
assert(index.includes('data-i18n="assistant.kicker"'), 'assistant kicker is translated via data-i18n');
assert(index.includes('data-i18n="assistant.title"'), 'assistant title is translated via data-i18n');
assert(index.includes('data-i18n="assistant.messageTitle"'), 'assistant message title is translated via data-i18n');
assert(index.includes('data-i18n-placeholder="assistant.machinePh"'), 'assistant machine placeholder is translated');
assert(index.includes('data-i18n-placeholder="assistant.scopePh"'), 'assistant scope placeholder is translated');
assert(i18n.en['assistant.messageTitle'].includes('Chat directly'), 'English assistant message title exists');
assert(i18n.en['assistant.mainQuestion'] === 'What is it mainly about?', 'English assistant question exists');
assert(i18n.en['assistant.prepare'] === 'Transfer to form', 'English assistant action exists');
assert(i18n.en['assistant.timelineUrgent'] === 'Urgent / this week', 'English assistant timeline option exists');
assert(index.includes('buildAssistantSummary'), 'deterministic triage summary function exists');
assert(index.includes('buildDietzAssistantPersona'), 'assistant has a DIETZ/Patrick persona contract');
assert(index.includes('buildAssistantFallbackReply'), 'assistant has a local fallback answer builder');
assert(index.includes('question_missing_local_prompt'), 'empty assistant questions get a useful local prompt instead of a disabled-widget message');
assert(index.includes('callAssistantEndpoint'), 'assistant can call a guarded backend endpoint when configured');
assert(index.includes('sendAssistantLead'), 'assistant can hand off leads to Patrick/Telegram through backend');
assert(index.includes('shouldEscalateToPatrick'), 'assistant detects questions that need Patrick review');
assert(index.includes('guidedAssistantState'), 'assistant has guided conversation state');
assert(index.includes('getAssistantNextQuestion'), 'assistant guides customers with targeted next questions');
assert(index.includes('isAssistantQuestionInScope'), 'assistant filters unrelated/off-topic questions');
assert(i18n.de['assistant.outOfScope'].includes('Aria beantwortet Fragen zu Herrn Dietz'), 'assistant has polished formal off-topic reply copy');
assert(index.includes('fillCustomerFieldsFromAssistant'), 'assistant can transfer contact details into the booking form');
assert(index.includes('requestLiveTakeover'), 'assistant has a live takeover request path for Patrick');
assert(index.includes('assistant.takeover'), 'assistant exposes a customer-facing takeover action');
assert(index.includes('assistant-chat-log'), 'assistant is presented as a real chat log, not a form-first wizard');
assert(index.includes('assistantChatInput'), 'assistant has a direct free-text chat input');
assert(index.includes('assistantTeaser') && index.includes('assistant-teaser-close') && index.includes('aria_assistant_teaser_dismissed_v1'), 'assistant launcher has a dismissible greeting teaser bubble');
assert(index.includes('assistant-launcher-icon') && index.includes('<svg') && index.includes('aria-label="Chat mit DIETZ öffnen"') && index.includes('M7.5 17.5'), 'assistant launcher uses a Chatbase-like circular chat/message bubble icon');
assert(index.includes('width: 3.9rem;') && index.includes('height: 3.9rem;') && index.includes('.assistant-launcher-text { display: none; }'), 'assistant launcher is icon-first/circular instead of a wide text pill');
assert(index.includes('operator_decision_buttons'), 'internal Patrick handoff model supports decision buttons');
assert(index.includes("'start_chat', 'let_aria_answer', 'end_chat'"), 'operator model includes start/end chat actions');
assert(index.includes('function appendChatMessage('), 'assistant chat send can append the customer message visibly to the chat log');
assert(index.includes('function rememberAssistantMessage(') && index.includes('guidedAssistantState.chatHistory'), 'assistant keeps a compact chat history for live AI context');
assert(index.includes("if (assistantConfig.liveAiEnabled && result.mode !== 'live_ai')") && index.includes("result.mode = 'ai_unavailable';"), 'remote AI failures are shown as unavailable instead of static fallback answers');
assert(index.includes("if (!assistantConfig.liveAiEnabled && result.mode !== 'live_ai') result.reply = buildConversationalAriaReply(summary, capturedField);"), 'static conversational fallback is limited to explicit offline mode only');
assert(index.includes('function syncFreeTextToSummary('), 'assistant chat send can sync free text before building a summary');
assert(index.includes('function notifyPatrickForLiveChat('), 'assistant notifies Patrick before AI fallback');
assert(index.includes('function startOperatorReplyPolling('), 'assistant starts polling for Patrick operator replies');
assert(index.includes('function pollOperatorReplies('), 'assistant can render Patrick replies from the local bridge');
assert(index.includes('function requestAiFallbackAfterOperatorWindow('), 'assistant defines the delayed Aria fallback callback');
assert(index.includes('function startOperatorWindowCountdown('), 'assistant shows a visible operator countdown before Aria takes over');
assert(index.includes('setTimeout(requestAiFallbackAfterOperatorWindow, 60000)'), 'assistant uses a practical 60-second operator window before Aria takes over');
assert(index.includes('guidedAssistantState.ariaActive'), 'assistant keeps Aria in the conversation after timeout instead of notifying Patrick every message');
assert(index.includes('guidedAssistantState.operatorWindowActive'), 'assistant collects follow-up customer messages during the 60-second operator window without repeating Patrick notifications');
assert(index.includes('shouldRequestPatrickFromMessage'), 'assistant only re-adds Patrick when the customer explicitly asks for Patrick or human takeover');
assert(index.includes("const initialWantsPatrick = shouldRequestPatrickFromMessage(message)") && index.includes('const wantsPatrick = initialWantsPatrick'), 'assistant separates Patrick-handoff intent from normal chat detail capture');
assert(index.includes("if (!wantsPatrick && !assistantConfig.liveAiEnabled && !capturedField) capturedField = updateGuidedSummaryFromExpectedField(message);"), 'Patrick handoff commands and live-AI chat turns are not stored as machine/scope answers');
assert(!index.includes("shouldRequestPatrickFromMessage(message) || !guidedAssistantState.patrickNotified"), 'assistant does not force a Patrick handoff on the first ordinary chat message');
assert(index.includes("patrick dazuholen") && !index.includes("return ['patrick', 'herr dietz', 'dietz'"), 'questions merely mentioning Patrick do not trigger human handoff');
assert(index.includes('function askForChatHandoffDetails(') && index.includes('appendHandoffQuickActions()'), 'missing consent/details stays in chat and shows handoff quick actions');
assert(index.includes('const email = value.match') && index.includes('assistantContactContact'), 'assistant extracts contact details from a natural chat message');
assert(i18n.de['assistant.operatorCountdown'].includes('{seconds}'), 'German assistant countdown text exposes seconds placeholder');
assert(i18n.de['assistant.operatorCollecting'].includes('60-Sekunden'), 'German assistant follow-up collection text explains the 60-second timer');
assert(index.includes('function updateGuidedSummaryFromExpectedField('), 'assistant updates the expected missing field from conversational follow-up answers');
assert(index.includes('function buildConversationalAriaReply('), 'assistant has a concise non-repetitive chat reply builder for follow-up turns');
assert(index.includes('guidedAssistantState.awaitingField'), 'assistant remembers which concrete detail Aria asked for next');
assert(index.includes('guidedAssistantState.answeredEplanIntro'), 'assistant does not repeat the long EPLAN intro on every follow-up turn');
assert(index.includes('function isLowInformationChatMessage('), 'assistant recognizes low-information pings like Hallo? without storing them as project details');
assert(i18n.de['assistant.askSpecificEplan'].includes('Welche konkrete EPLAN-Frage'), 'assistant asks a specific EPLAN follow-up instead of repeating generic EPLAN copy');
assert(i18n.de['assistant.ackMachine'].includes('{machine}'), 'assistant can acknowledge captured machine details in chat');
assert(index.includes('guidedAssistantState.operatorActive'), 'assistant enters an operator-active mode after Patrick replies');
assert(index.includes('function forwardCustomerMessageToOperator('), 'assistant forwards follow-up customer messages to Patrick while operator mode is active');
assert(index.includes('setInterval(pollOperatorReplies, 1200)'), 'assistant polls operator replies quickly enough for local livechat testing');
assert(index.includes('function updateGuidedSummaryFromMessageIntent('), 'assistant detects timeline/contact/price/drive-count intents from natural chat messages');
assert(i18n.de['assistant.priceBoundary'].includes('keinen belastbaren Preis'), 'assistant answers price questions with a practical non-binding boundary instead of repeating contact prompts');
assert(i18n.de['assistant.operatorActiveNotice'].includes('übernimmt jetzt den Chat'), 'customer sees that Patrick, not Aria, has taken over the chat');
const assistantConfig = fs.readFileSync(path.join(root, 'src/static/assistant-config.js'), 'utf8');
assert(assistantConfig.includes('endpoint: "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant"'), 'public assistant config points to the Supabase Aria endpoint by default');
assert(assistantConfig.includes('liveAiEnabled: true'), 'public assistant config enables Aria as the primary AI');
assert(assistantConfig.includes('localDevEndpoint: "http://127.0.0.1:8790/assistant"'), 'local assistant config keeps the localhost bridge for Patrick testing');
assert(assistantConfig.includes('localProxyEndpoint: "http://127.0.0.1:8790/assistant"'), 'local assistant config exposes the same-origin-friendly AI proxy for localhost website tests');
assert(assistantConfig.includes('remoteTestEndpoint: "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant"'), 'local assistant config exposes the Supabase assistant endpoint for ?aria=remote tests');
assert(fs.existsSync(path.join(root, 'scripts/local_assistant_bridge.py')), 'local assistant Telegram bridge script exists for dev handoff testing');
const localBridge = fs.readFileSync(path.join(root, 'scripts/local_assistant_bridge.py'), 'utf8');
assert(localBridge.includes('send_message_tool'), 'local assistant bridge forwards handoff via Hermes messaging');
assert(localBridge.includes('/operator/reply') && localBridge.includes('/assistant/replies'), 'local assistant bridge exposes operator reply and website polling endpoints');
assert(localBridge.includes('REMOTE_ASSISTANT_ENDPOINT') && localBridge.includes('_proxy_remote_assistant'), 'local assistant bridge proxies /assistant chat calls to the remote Supabase AI function');
assert(localBridge.includes('"mode": "ai_unavailable"') && localBridge.includes('Aria-KI ist aktuell nicht erreichbar'), 'local assistant bridge turns remote fallback into AI-unavailable instead of fake chat answers');
assert(localBridge.includes('/operator/customer-message'), 'local bridge accepts live customer follow-up messages after Patrick has taken over');
assert(localBridge.includes('Antwort an Chat') && localBridge.includes('Direkt antworten'), 'local bridge sends Patrick a copyable direct-reply prompt for each customer message');
assert(localBridge.includes('/operator/ui') && localBridge.includes('Antwort senden'), 'local bridge exposes a clickable browser reply UI for Patrick');
assert(localBridge.includes('Antworten öffnen') && localBridge.includes('reply_url'), 'operator notification includes a direct answer link so Patrick does not have to copy prompts');
assert(localBridge.includes('detect_message_language') && localBridge.includes('zh') && localBridge.includes('es'), 'operator bridge detects Spanish and Chinese customer messages for Patrick');
const languageSmoke = execFileSync(pythonBin, ['-c', `
import importlib.util
spec = importlib.util.spec_from_file_location('bridge', 'scripts/local_assistant_bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
assert bridge.detect_message_language('Hola, tengo una pregunta de EPLAN P8') == 'es'
assert bridge.detect_message_language('Hole tengo una pregunta de eplan p8') == 'es'
assert bridge.detect_message_language('Ich habe eine Frage zu EPLAN P8') == 'de'
assert bridge.detect_message_language('我有一个EPLAN问题') == 'zh'
`], { cwd: root, encoding: 'utf8' });
assert(languageSmoke !== null, 'local bridge language detector classifies Spanish tengo/Hola, German and Chinese correctly');
assert(localBridge.includes('prepare_operator_reply') && localBridge.includes('corrected_message') && localBridge.includes('translated_message'), 'operator bridge prepares grammar-corrected and translated operator replies before delivery');
assert(localBridge.includes('/operator/prepare-reply') && localBridge.includes('Entwurf prüfen'), 'operator UI has a draft review step before sending translated replies');
assert(localBridge.includes('Übersetzung für Patrick') && localBridge.includes('Antwortsprache'), 'operator UI shows inbound translation context and outbound language mode');
assert(/Herrn? Dietz/.test(i18n.de['assistant.greeting']), 'assistant has a warm formal livechat greeting about Herr Dietz');
assert(/Herrn? Dietz/.test(i18n.de['assistant.waitingPatrick']), 'assistant tells customer Herr Dietz is being notified without exposing internals');
assert(i18n.de['assistant.aiFallback'].includes('nicht direkt verfügbar'), 'assistant has polished AI fallback after Patrick timeout');
assert(index.includes('textarea[name="project"]'), 'assistant targets existing booking project textarea');
assert(index.includes('missing_information'), 'assistant records missing-information queue');
assert(i18n.de['assistant.privacyNote'].includes('sensiblen Kundendaten'), 'confidentiality warning exists in i18n without project-document wording');
assert(index.includes("#bookingForm textarea[name=\"project\"], textarea[name=\"project\"]"), 'assistant targets the booking project textarea robustly');
assert(index.includes("projectField.dispatchEvent(new Event('input', { bubbles: true }))"), 'assistant notifies the form after autofilling project text');
assert(index.includes('pkgField.value = summary.project_type'), 'assistant transfers translated selected project type into the package field');
assert(index.includes('stats-intro'), 'stats intro prevents abrupt transition into metrics');
assert(index.includes('trust-intro'), 'trust intro prevents abrupt transition into industries/tools');
assert(index.includes('html[lang="es"] .section-label'), 'Spanish labels are not forced into wide uppercase');
assert((index.match(/function buildAssistantSummary\(\)/g) || []).length === 1, 'assistant script exists exactly once');
assert((index.match(/\.assistant-launcher \{\n  position: fixed;/g) || []).length === 1, 'assistant CSS exists exactly once');
assert(index.includes('window.__dietzThemeBound'), 'theme toggle is bootstrapped independently before lower feature scripts');
assert(index.includes('[data-theme="light"] .privacy-backdrop'), 'privacy overlay stays light in light mode');
assert(index.includes('width: min(100%, 2172px);'), 'hero banner is not upscaled beyond native width');
assert(index.includes('font-size: clamp(2.35rem, 4.9vw, 4.35rem);'), 'desktop hero headline is capped smaller for wide screens');
assert(index.includes('.assistant-panel {\n  position: fixed;\n  right: 1.25rem;\n  top: 5.5rem;'), 'assistant panel is pinned below nav so close button remains reachable');
assert(index.includes('max-height: none;') && index.includes('.assistant-body {\n  flex: 1 1 auto;\n  min-height: 0;') && index.includes('.assistant-chat-log {\n  flex: 0 0 auto;\n  min-height: 9.5rem;\n  max-height: min(34dvh, 18rem);'), 'assistant panel keeps header/compose/footer visible and prevents the mobile chat log from collapsing');
assert(index.includes('.assistant-close {\n  flex: 0 0 auto;\n  display: grid;'), 'assistant close button keeps a fixed accessible hit area');
assert(!index.includes('Live-KI ist noch nicht für den öffentlichen Betrieb aktiviert'), 'public UI does not show non-working/live-disabled chatbot copy');
assert(index.includes('Late mobile safety overrides') && index.includes('.process-grid {\n    grid-template-columns: 1fr;\n    gap: 2rem;') && index.includes('.proc-step h3,\n  .proc-step p {\n    text-align: left;'), 'mobile process cards stack full-width with readable left-aligned text');
assert(index.includes('.proj-grid,\n  .progressive-disclosure .proj-grid,\n  .process-grid {\n    grid-template-columns: 1fr;') && index.includes('.proj-meta {\n    align-items: flex-start;') && index.includes('.proj-card p {\n    font-size: 0.98rem;'), 'mobile project cards stack full-width and avoid narrow clipped columns');
assert(index.includes('.nav-links:not(.open) { display: none; }'), 'late mobile nav override prevents compressed desktop links on phones');
assert(index.includes("document.querySelectorAll('.fade').forEach(el => el.classList.add('in'))"), 'fade sections are made visible immediately after JS boot');
assert(i18n.en['sit.title'].includes('external review') || i18n.en['sit.title'].includes('familiar'), 'English project-situations title reframes concrete failure patterns');
assert(i18n.en['sit.subtitle'].includes('copy-paste from old projects') && i18n.en['sit.subtitle'].includes('rework'), 'English project-situations subtitle names concrete engineering problems');
assert(i18n.de['hero.h1a'].includes('Freiberufliche Elektrokonstruktion'), 'hero states freelance electrical design immediately');
assert(i18n.de['hero.subnote'].includes('passt / passt nicht') && i18n.de['hero.subnote'].includes('welche Unterlagen fehlen'), 'hero is optimized for fast buyer decision scanning');
assert(i18n.de['hero.cta1'] === 'Ersteinschätzung buchen', 'primary CTA is assessment-oriented');
assert(!i18n.de['about.title'].includes('Ich komme aus der Maschine'), 'about title avoids inaccurate machine-origin wording');
assert(i18n.de['about.title'].includes('Maschinen- und Anlagenbau') && i18n.de['about.title'].includes('Praxis'), 'about title positions real machine-building practice');
assert(i18n.de['about.p1'].includes('Lager') && i18n.de['about.p1'].includes('Arbeitsvorbereitung') && i18n.de['about.p1'].includes('Schaltschrankbau'), 'about copy shows shopfloor-to-engineering lifecycle breadth');
assert(i18n.de['about.p1'].includes('VDE') && i18n.de['about.p1'].includes('Montage') && i18n.de['about.p1'].includes('Kunde'), 'about copy includes testing, machine installation and customer-site reality');
assert(i18n.de['about.p2'].includes('Kick-off') && i18n.de['about.p2'].includes('Lasten') && i18n.de['about.p2'].includes('Pflichtenheft'), 'about copy includes project clarification and specification work');
assert(i18n.de['about.p2'].includes('Lieferanten') && i18n.de['about.p2'].includes('Montageteams') && i18n.de['about.p2'].includes('finanzieller Verantwortung'), 'about copy includes supplier, team coordination and responsibility');
assert(i18n.de['sit.title'].includes('Fehler') && i18n.de['sit.title'].includes('Blick von außen'), 'situations section qualifies fit through concrete failure patterns');
assert(!i18n.de['sit.subtitle'].includes('Wenn nicht, soll die Seite genauso schnell aussortieren'), 'situations subtitle avoids weak self-referential sorting copy');
assert(i18n.de['sit.subtitle'].includes('Copy-Paste') && i18n.de['sit.subtitle'].includes('Nacharbeit'), 'situations subtitle names concrete engineering failure patterns');
assert(i18n.de['sit.s1Text'].includes('Altprojekten') && i18n.de['sit.s1Text'].includes('kopiert'), 'situations include old-project copy errors');
assert(i18n.de['sit.s2Title'].includes('Stückliste') || i18n.de['sit.s2Text'].includes('Stücklisten'), 'situations include BOM mismatch risk');
assert((i18n.de['sit.s3Text'].includes('Verdrahtung') || i18n.de['sit.s3Text'].includes('Verdrahten')) && i18n.de['sit.s3Text'].includes('Inbetriebnahme'), 'situations include wiring errors found during commissioning');
assert(i18n.de['sit.s4Text'].includes('SPS') && (i18n.de['sit.s4Text'].includes('I/O') || i18n.de['sit.s4Text'].includes('Signale')), 'situations include PLC/I/O assignment drift');
assert(i18n.de['trust.title'].includes('Praxisnähe'), 'trust section is explicit for industrial clients');
assert(i18n.de['trust.subtitle'].includes('technisch fundiertes Verständnis') && i18n.de['trust.subtitle'].includes('Marktreife'), 'trust copy includes technical understanding and market-readiness R&D contribution');
assert(i18n.de['about.p2'].includes('Research-Projekten') && i18n.de['about.p2'].includes('Marktreife'), 'about copy includes R&D contribution toward market readiness');
assert(i18n.en['trust.subtitle'].includes('technically grounded understanding') && i18n.en['trust.subtitle'].includes('market readiness'), 'English trust copy includes R&D market-readiness positioning');
assert(i18n.de['bk.title'].includes('Ersteinschätzung'), 'booking section makes the next step explicit');
assert(i18n.en['hero.h1a'].includes('Freelance electrical design'), 'English hero states freelance electrical design immediately');
assert(i18n.en['hero.cta1'] === 'Book assessment', 'English primary CTA is assessment-oriented');
assert((renderedIndex.match(/class="proj-card fade project-visible"/g) || []).length === 3, 'project section keeps three representative cards immediately visible');
assert((renderedIndex.match(/class="proj-card fade project-extra"/g) || []).length >= 3, 'additional project proof remains available via progressive disclosure');
assert(renderedIndex.includes('class="progressive-disclosure project-more'), 'project examples are folded instead of deleted');
assert((renderedIndex.match(/class="faq-item faq-visible"/g) || []).length === 5, 'FAQ keeps five key questions immediately visible');
assert((renderedIndex.match(/class="faq-item faq-extra"/g) || []).length >= 2, 'additional FAQ trust content remains available via progressive disclosure');
assert(renderedIndex.includes('class="progressive-disclosure faq-more'), 'FAQ extras are folded instead of deleted');
assert(!renderedIndex.includes('<section id="education">'), 'education section is not a full extra section');
assert(renderedIndex.includes('credential-strip') && renderedIndex.includes('Elektroniker für Betriebstechnik') && renderedIndex.includes('Staatlich geprüfter Techniker'), 'education credentials are compactly folded into about section');
assert(index.includes('data-i18n-aria-label="about.credentialsLabel"') && i18n.en['about.credentialsLabel'] === 'Education and qualification', 'compact education credentials have a translatable accessibility label');
assert(i18n.de['prj.moreSummary'].includes('Weitere Projektbeispiele') && i18n.en['faq.moreSummary'].includes('Show more'), 'progressive disclosure labels are translated');
assert(i18n.de['nav.booking'] === 'Ersteinschätzung', 'navigation frames booking as technical assessment');
assert(i18n.de['hero.badge'].includes('Senior') || i18n.de['hero.badge'].includes('EPLAN'), 'hero badge positions premium specialist support');
assert(i18n.de['hero.tagline'].includes('ohne Agentur-Ebene'), 'hero reinforces direct solo provider trust');
assert(i18n.de['hero.meta4'].includes('14 Märkte') && i18n.en['hero.meta4'].includes('14 markets'), 'hero reflects broader international market experience');
assert(i18n.de['stats.countries'].includes('Bediente Märkte') && i18n.de['stats.countries'].includes('Vor-Ort-Erfahrung'), 'stats label frames markets served without overclaiming all on-site');
assert(i18n.de['trust.locations'].includes('Pakistan') && i18n.de['trust.locations'].includes('Mexiko') && i18n.de['trust.locations'].includes('Schweden'), 'trust locations include the expanded market list');
assert(renderedIndex.includes('<div class="stat-value">14</div>'), 'market count is rendered as 14');
assert(i18n.de['hero.tagline'].includes('externem Projektfokus'), 'hero explains the value of an external focused specialist');
assert(i18n.de['srv.subtitle'].includes('klar vereinbartem Scope') && i18n.de['srv.subtitle'].includes('Projektbudget'), 'services explain fixed scope and budget discipline before start');
assert(i18n.de['sit.subtitle'].includes('Daily Business') && i18n.de['sit.subtitle'].includes('interne Themen'), 'situations explain why external focus can protect project progress');
assert(i18n.de['depth.subtitle'].includes('abgegrenzter externer Scope') && i18n.de['depth.subtitle'].includes('Budget'), 'technical-depth copy connects external scope with budget control');
assert(i18n.en['hero.tagline'].includes('external project focus'), 'English hero explains external focused specialist value');
assert(index.includes('<a href="#situations" class="btn btn-secondary">'), 'secondary hero CTA links to bottleneck fit check');
assert(index.indexOf('<section id="services">') < index.indexOf('<section id="about">'), 'services appear before about for faster buyer decision');
assert(!index.includes('<div class="stat-value">100<sup>%</sup></div>'), 'stats do not imply absolute CE/UL/EMV guarantee');
assert(i18n.de['srv.priceOnRequest'].includes('vor Start klar vereinbart'), 'service pricing is framed as professional scope agreement');
assert(i18n.de['bk.freeNote'].includes('freundlich') && i18n.de['bk.freeNote'].includes('ohne technische Detailberatung ohne Auftrag'), 'first call is positioned as friendly qualification not free consulting');
assert(i18n.de['bk.subtitle'].includes('Terminplan') && i18n.de['bk.subtitle'].includes('ohne vertrauliche Dateien') && !i18n.de['bk.subtitle'].includes('Zeitdruck') && !i18n.de['bk.subtitle'].includes('Unterlagen grob vor'), 'booking subtitle asks for schedule/document status without confidential files');
assert(i18n.de['bk.consultIntro'].includes('Terminplan') && i18n.de['bk.consultIntro'].includes('ohne vertrauliche Details') && !i18n.de['bk.consultIntro'].includes('Terminrisiko') && !i18n.de['bk.consultIntro'].includes('vorhandene Unterlagen,'), 'booking consult intro avoids harsh pressure wording and requesting confidential documents');
assert(i18n.de['bk.fProjectPh'].includes('Terminplan') && i18n.de['bk.fProjectPh'].includes('aktueller Bedarf') && i18n.de['bk.fProjectPh'].includes('ohne vertrauliche Inhalte') && !i18n.de['bk.fProjectPh'].includes('akuter Engpass') && !i18n.de['bk.fProjectPh'].includes('vorhandene Unterlagen,'), 'booking placeholder is friendlier and consistent with confidentiality warning');
assert(i18n.en['bk.subtitle'].includes('schedule') && i18n.en['bk.subtitle'].includes('without confidential files') && !i18n.en['bk.subtitle'].includes('time pressure'), 'English booking subtitle uses schedule and avoids confidential files');

const packages = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/packages.json'), 'utf8'));
const faq = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/faq.json'), 'utf8'));
assert(packages.items[0].name.de === 'Technische Erstbewertung', 'quick package is outcome-oriented');
assert(packages.items[1].name.de === 'EPLAN Qualitätsreview', 'review package is premium and concrete');
assert(faq.items.some(item => item.question.de.includes('Wann passt') && item.answer.de.includes('reine Preisvergleiche')), 'FAQ includes fit/no-fit qualification');
assert(faq.items.some(item => item.question.de.includes('Unterlagen') && item.answer.de.includes('EPLAN-Version') && item.answer.de.includes('Stückliste')), 'FAQ tells buyers which documents speed up assessment');
assert(faq.items.some(item => item.question.en.includes('documents') && item.answer.en.includes('EPLAN version') && item.answer.en.includes('BOM')), 'English FAQ tells buyers which documents speed up assessment');

const forbidden = [
  'Noch kein Live-KI-Chat',
  'DIETZ Assistent · Vorschau',
  'stellt erste technische Fragen',
  'KI-Backend',
  'Cloudflare Worker',
  'clients who run without me',
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'claude.ai',
  'fetch(\'/chat',
  'fetch("/chat',
  'fetch(`/chat'
];
for (const marker of forbidden) {
  assert(!index.includes(marker), `no live AI/backend endpoint in static v0: ${marker}`);
}

for (const lang of ['de', 'en', 'es', 'zh']) {
  assert(i18n[lang]['pv.cat2Desc'] && !i18n[lang]['pv.cat2Desc'].includes('Google-CDN'), `${lang} privacy font text no longer claims Google CDN`);
  assert(i18n[lang]['pv.cat4Desc'] && /Google|Calendar|日历/.test(i18n[lang]['pv.cat4Desc']), `${lang} privacy calendar text exists`);
}

for (const [lang, forbiddenPattern] of [
  ['de', /\b(Wir|wir)\b/],
  ['en', /\b(We|we|We'll|we'll|our|Our)\b/],
  ['es', /\b(Hablaremos|hablaremos|Definimos)\b/],
  ['zh', /我们/]
]) {
  for (const key of ['bk.introLine', 'bk.consultIntro']) {
    assert(!forbiddenPattern.test(i18n[lang][key] || ''), `${lang} ${key} avoids team-implying wording`);
  }
}

const executableScripts = [...renderedIndex.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert(executableScripts.length >= 2, 'executable scripts exist for early theme and main behavior');
for (const [scriptIndex, script] of executableScripts.entries()) {
  const tempPath = path.join('/tmp', `dietz-website-script-${scriptIndex}.js`);
  fs.writeFileSync(tempPath, script);
  try {
    execFileSync('node', ['--check', tempPath], { stdio: 'pipe' });
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    assert(false, `generated executable script ${scriptIndex} has valid JavaScript syntax`);
  }
}

console.log('chatbot_assistant_smoke.test.js: OK');
