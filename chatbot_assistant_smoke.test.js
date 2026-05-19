const fs = require('fs');
const path = require('path');

const root = __dirname;
const index = fs.readFileSync(path.join(root, 'src', 'index.njk'), 'utf8');
const renderedIndexPath = path.join(root, '_site', 'index.html');
const renderedIndex = fs.existsSync(renderedIndexPath) ? fs.readFileSync(renderedIndexPath, 'utf8') : index;
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'src/_data/i18n.json'), 'utf8'));
const { execFileSync } = require('child_process');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(index.includes('AI ASSISTANT PREVIEW'), 'assistant CSS/HTML/JS marker exists');
assert(index.includes('id="assistantLauncher"'), 'assistant launcher exists');
assert(index.includes('id="assistantPanel"'), 'assistant panel exists');
assert(index.includes('Projektanfrage strukturiert vorbereiten'), 'production assistant copy is visible');
assert(index.includes('data-i18n="assistant.kicker"'), 'assistant kicker is translated via data-i18n');
assert(index.includes('data-i18n="assistant.title"'), 'assistant title is translated via data-i18n');
assert(index.includes('data-i18n="assistant.messageTitle"'), 'assistant message title is translated via data-i18n');
assert(index.includes('data-i18n-placeholder="assistant.machinePh"'), 'assistant machine placeholder is translated');
assert(index.includes('data-i18n-placeholder="assistant.scopePh"'), 'assistant scope placeholder is translated');
assert(i18n.en['assistant.messageTitle'] === 'Prepare project inquiry in a structured way.', 'English assistant message title exists');
assert(i18n.en['assistant.mainQuestion'] === 'What is it mainly about?', 'English assistant question exists');
assert(i18n.en['assistant.prepare'] === 'Prepare inquiry', 'English assistant action exists');
assert(i18n.en['assistant.timelineUrgent'] === 'Urgent / this week', 'English assistant timeline option exists');
assert(index.includes('buildAssistantSummary'), 'deterministic triage summary function exists');
assert(index.includes('textarea[name="project"]'), 'assistant targets existing booking project textarea');
assert(index.includes('missing_information'), 'assistant records missing-information queue');
assert(i18n.de['assistant.privacyNote'].includes('Keine vertraulichen Kundendaten'), 'confidentiality warning exists in i18n');
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
assert(index.includes('max-height: none;') && index.includes('.assistant-body {\n  padding: 1rem;\n  overflow-y: auto;'), 'assistant panel uses body scrolling instead of hiding the header/close button');
assert(index.includes('.assistant-close {\n  flex: 0 0 auto;\n  display: grid;'), 'assistant close button keeps a fixed accessible hit area');
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
