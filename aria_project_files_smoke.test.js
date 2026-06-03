const fs = require('fs');
const path = require('path');

const root = __dirname;
const ariaDir = path.join(root, 'src/_data/aria');
const index = fs.readFileSync(path.join(root, 'src', 'index.njk'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const requiredFiles = [
  'identity.json',
  'services.json',
  'project_templates.json',
  'decision_rules.json',
  'handoff_rules.json',
  'intake_questions.json',
  'memory_policy.json',
];

for (const file of requiredFiles) {
  const filePath = path.join(ariaDir, file);
  assert(fs.existsSync(filePath), `Aria project file exists: ${file}`);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert(parsed && typeof parsed === 'object', `${file} contains a JSON object`);
}

const identity = JSON.parse(fs.readFileSync(path.join(ariaDir, 'identity.json'), 'utf8'));
assert(identity.role === 'Technische Assistentin', 'Aria identity names her as Technische Assistentin');
assert(identity.boundaries && identity.boundaries.includes('no_binding_offers'), 'identity carries binding-offer boundary');
assert(identity.review_required && identity.review_required.includes('prices'), 'identity requires Patrick review for prices');

const services = JSON.parse(fs.readFileSync(path.join(ariaDir, 'services.json'), 'utf8'));
assert(Array.isArray(services.services) && services.services.length >= 3, 'services define DIETZ service knowledge');
assert(services.services.some(service => service.id === 'eplan_p8_support'), 'services include EPLAN P8 support');
assert(services.services.some(service => service.keywords.includes('Klemmen') && service.keywords.includes('I/O')), 'services include Klemmen/I/O keywords');

const templates = JSON.parse(fs.readFileSync(path.join(ariaDir, 'project_templates.json'), 'utf8'));
assert(Array.isArray(templates.project_templates) && templates.project_templates.length >= 3, 'project templates define reusable project drafts');
assert(templates.project_templates.every(template => template.aria_may_accept === false && template.patrick_review_required === true), 'templates keep final acceptance with Patrick');
assert(templates.project_templates.some(template => template.id === 'cabinet_io_cleanup'), 'templates include cabinet/I-O cleanup');

const rules = JSON.parse(fs.readFileSync(path.join(ariaDir, 'decision_rules.json'), 'utf8'));
assert(Array.isArray(rules.rules) && rules.rules.some(rule => rule.next_action === 'offer_patrick_contact'), 'decision rules can suggest Patrick contact');
assert(rules.rules.some(rule => rule.project_fit === 'review_required'), 'decision rules include review-required boundaries');

const handoff = JSON.parse(fs.readFileSync(path.join(ariaDir, 'handoff_rules.json'), 'utf8'));
assert(handoff.required_for_handoff.includes('consent'), 'handoff requires explicit consent');
assert(handoff.nice_to_have.includes('eplan_version'), 'handoff asks for EPLAN version when useful');

const intake = JSON.parse(fs.readFileSync(path.join(ariaDir, 'intake_questions.json'), 'utf8'));
assert(intake.questions.some(question => question.id === 'documents_available'), 'intake questions include available documents');
assert(intake.questions.every(question => question.review_status === 'review_required_before_binding_offer'), 'intake questions keep review boundary visible');

const memoryPolicy = JSON.parse(fs.readFileSync(path.join(ariaDir, 'memory_policy.json'), 'utf8'));
assert(memoryPolicy.durable_memory_type === 'curated_requirements_knowledge', 'Aria durable memory is curated requirements/knowledge, not chat history');
assert(memoryPolicy.forbidden_storage.includes('persistent_chat_history'), 'Aria must not persist visitor chat history');
assert(memoryPolicy.allowed_storage.includes('patrick_approved_requirements'), 'Aria may keep Patrick-approved requirements');
assert(memoryPolicy.runtime_context_policy === 'short_term_session_context_only', 'Aria may only use short-term session context during a live chat');

assert(index.includes('DIETZ_ASSISTANT_PROJECT_FILES'), 'website embeds the externalized Aria project files');
assert(index.includes('{{ aria.identity | dump | safe }}'), 'identity is loaded from src/_data/aria/identity.json');
assert(index.includes('{{ aria.project_templates | dump | safe }}'), 'project templates are loaded from src/_data/aria/project_templates.json');
assert(index.includes('{{ aria.memory_policy | dump | safe }}'), 'memory policy is loaded from src/_data/aria/memory_policy.json');
assert(index.includes('memory_policy: DIETZ_ASSISTANT_PROJECT_FILES.memory_policy'), 'assistant persona carries curated memory policy');
assert(index.includes('classifyAssistantProjectFromFiles'), 'assistant has a project-file classification helper');
assert(index.includes('project_file_classification'), 'assistant result carries project-file classification marker');

console.log('aria_project_files_smoke.test.js: OK');
