# Website Chatbot Assistant v0 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Prepare a safe first visible assistant path for dietz-engineering.com without paid APIs or server-side secrets.

**Architecture:** v0 is a local-only browser assistant embedded in the static Eleventy site. It does deterministic project triage, drafts a structured inquiry into the existing Web3Forms form, and documents the later backend contract for a Cloudflare Worker + LLM + ERP/configurator handoff.

**Tech Stack:** Eleventy static HTML/CSS/JS, existing Web3Forms form, later Cloudflare Worker/Turnstile/LLM behind explicit approval.

---

### Task 1: Add local-only assistant UI

**Objective:** Add a floating assistant preview that cannot leak data to an AI backend because no backend call exists yet.

**Files:**
- Modify: `src/index.njk`

**Acceptance:**
- Floating button exists: `Assistent vorbereiten`
- Panel states clearly: no live AI chat, no backend call, local browser only
- It asks for project type, machine, scope and timeline

### Task 2: Connect assistant to inquiry form

**Objective:** Use the assistant as a structured lead prefill for the existing project inquiry form.

**Files:**
- Modify: `src/index.njk`

**Acceptance:**
- `Anfrage vorbereiten` writes a deterministic summary into `textarea[name="project"]`
- Output includes project type, machine, scope, timeline, missing information and confidentiality note
- Existing Web3Forms submission remains the only external submission path

### Task 3: Keep privacy text truthful

**Objective:** Ensure the privacy modal does not claim external fonts or embedded calendar when the current implementation uses local fonts and a click-out calendar link.

**Files:**
- Modify: `src/index.njk`
- Modify: `src/_data/i18n.json`

**Acceptance:**
- Privacy copy says local fonts
- Calendar is described as external link, contacted after click
- Assistant preview is described as local-only/no AI backend

### Task 4: Verification

**Objective:** Prevent accidental introduction of external assistant calls or missing markers.

**Files:**
- Create: `chatbot_assistant_smoke.test.js`

**Acceptance:**
- Test asserts UI markers, local-only copy, form-prefill contract, no OpenAI/Anthropic/Claude endpoint, no `/chat` fetch
- `npm run build` passes
