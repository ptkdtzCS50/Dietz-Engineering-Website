// @ts-nocheck
declare const Deno: any;

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_MESSAGE_CHARS = 1800;
const MAX_REQUESTS_PER_IP = 12;
const RATE_WINDOW_MS = 10 * 60 * 1000;

type AssistantPayload = {
  question?: string;
  messages?: { role?: string; content?: string }[];
  context?: Record<string, unknown>;
  language?: string;
  customer?: Record<string, unknown>;
  confirmed?: boolean;
  fallback_reason?: string;
};

type OperatorReply = { id: number; action: string; message: string; created_at: string };
type OperatorMessage = { id: number; role: string; message: string; created_at: string };
type OperatorReview = { target_language: string; language_label: string; translation_for_patrick: string; corrected_message: string; final_message: string; suggestions: string[]; review_status: string; notes: string[] };
type OperatorSession = { token: string; replies: OperatorReply[]; nextId: number; createdAt: number };

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const OPERATOR_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const operatorSessions = new Map<string, OperatorSession>();

function env(name: string): string {
  return Deno.env.get(name) || "";
}

function supabaseRestHeaders() {
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SERVICE_ROLE_KEY");
  if (!env("SUPABASE_URL") || !key) return null;
  return {
    "apikey": key,
    "authorization": `Bearer ${key}`,
    "content-type": "application/json",
  };
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const headers = supabaseRestHeaders();
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  if (!headers || !base) throw new Error("supabase_rest_unavailable");
  return await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
}

function cleanText(value: unknown, max = 4000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function redactContactData(value: unknown, max = 4000): string {
  return cleanText(value, max)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:\+|00)\d[\d\s()./-]{6,}\d/g, "[redacted-phone]")
    .replace(/\b(?:tel|telefon|phone|mobile|handy|whatsapp|e-mail|email|mail)\s*[:=]\s*\S+(?:\s+\S+){0,2}/gi, "[redacted-contact]")
    .replace(/\b(?:firma|company|unternehmen)\s*[:=]\s*\S+(?:\s+\S+){0,4}/gi, "[redacted-company]");
}

function sanitizeContextForAi(context: Record<string, unknown> = {}) {
  return {
    project_type: redactContactData(context.project_type, 220),
    machine: redactContactData(context.machine, 260),
    timeline: redactContactData(context.timeline, 180),
    scope: redactContactData(context.scope, 1200),
  };
}

function sanitizePayloadForAi(payload: AssistantPayload): AssistantPayload {
  return {
    question: redactContactData(payload.question, MAX_MESSAGE_CHARS),
    messages: normalizeMessages(payload).map((message) => ({
      role: message.role,
      content: redactContactData(message.content, MAX_MESSAGE_CHARS),
    })),
    context: sanitizeContextForAi(payload.context || {}),
    language: cleanText(payload.language, 8),
    confirmed: false,
    fallback_reason: cleanText(payload.fallback_reason, 120),
  };
}

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function htmlResponse(html: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(html, {
    status,
    headers: { ...headers, "content-type": "text/html; charset=utf-8" },
  });
}

const DEFAULT_ALLOWED_ORIGINS = ["https://dietz-engineering.com", "https://www.dietz-engineering.com"];

function allowedOrigins(): string[] {
  const configured = env("ASSISTANT_ALLOWED_ORIGIN")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin") || "";
  return !origin || allowedOrigins().includes(origin);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowOrigin = allowedOrigins().includes(origin) ? origin : allowedOrigins()[0];
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-turnstile-token",
    "vary": "origin",
  };
}

function rateLimit(request: Request): { ok: boolean; fallback_reason?: string } {
  const now = Date.now();
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_IP) return { ok: false, fallback_reason: "rate_limit_fallback" };
  return { ok: true };
}

async function readJson(request: Request): Promise<AssistantPayload | null> {
  try { return await request.json(); } catch { return null; }
}

function normalizeMessages(payload: AssistantPayload): { role: "user" | "assistant"; content: string }[] {
  const raw: { role?: string; content?: string }[] = Array.isArray(payload.messages) && payload.messages.length
    ? payload.messages
    : [{ role: "user", content: payload.question || "" }];
  return raw.slice(-12).map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: cleanText(message.content, MAX_MESSAGE_CHARS),
  })).filter((message) => message.content);
}

function systemPrompt(language = "de") {
  return [
    "You are Aria, the DIETZ project assistant for Patrick Dietz / Herr Dietz.",
    `Answer in the user's language when possible. Preferred language: ${cleanText(language, 8)}.`,
    "Purpose: build trust by answering first technical questions honestly and concretely, not by overselling.",
    "Refer to Patrick Dietz in customer-facing German answers formally as Herr Dietz, not casually as Patrick, unless quoting system/operator status.",
    "Patrick Dietz supports freelance electrical engineering for machine and plant builders: EPLAN P8 schematics, macro/article/BMK structure, terminals, cables, BOM consistency, panel-building documentation, Pro Panel/Smartwiring context, installation, commissioning, retrofit troubleshooting, and structured project handover.",
    "For EPLAN macros: say Herr Dietz can generally help assess existing structures, prepare project-suitable macros, and build reusable standards, but the concrete macro type, Data Portal data, Pro Panel 3D macro, and customer library must be checked from the project context.",
    "Never claim certifications, guaranteed CE/Safety/legal compliance, fixed prices, fixed delivery dates, or final engineering release.",
    "Never invent email addresses, phone numbers, employee counts, customer names, references, discounts, hourly rates, or other contact/company facts. If a contact route is needed, refer to the official website contact details or the website handoff form only.",
    "Do not store or imply persistent visitor chat memory. Aria's durable knowledge is curated DIETZ requirements, service knowledge, boundaries, and handoff rules explicitly maintained by Patrick/Hermes; visitor chat history is only short-term session context.",
    "Do not promise a callback time, same-day response, or any concrete response time. You may say Herr Dietz checks customer inquiries personally and a handoff can be prepared.",
    "Do not say you cannot contact Mr Dietz directly. Instead: explain in German with correct cases: die Website kann eine Übergabe an Herrn Dietz über den privaten Telegram-Operator-Kanal vorbereiten, nach ausdrücklicher Zustimmung und ausreichenden Kontakt-/Projektdaten.",
    "Never ask for passwords, secrets, sensitive customer data, or confidential internal details in chat. Recommend a suitable secure channel after first contact when needed.",
    "For handoff requests: ask for name, preferred contact route, topic, urgency, and explicit consent; explain in German that contact details are forwarded to Herrn Dietz only after consent. Use 'Herr Dietz' as subject and 'Herrn Dietz' after an/zu/für/von/mit.",
    "Herr Dietz prüft verbindliche Fragen persönlich.",
    "Keep answers compact, calm, practical, and customer-facing.",
  ].join("\n");
}

function contextPrompt(context: Record<string, unknown> = {}) {
  return [
    "Current website triage context:",
    `Project type: ${cleanText(context.project_type, 220) || "not specified"}`,
    `Machine / plant: ${cleanText(context.machine, 260) || "not specified"}`,
    `Timeline: ${cleanText(context.timeline, 180) || "not specified"}`,
    `Short description: ${cleanText(context.scope, 1200) || "not specified"}`,
  ].join("\n");
}

function assistantAiEnabled(): boolean {
  return env("ASSISTANT_ENABLED").trim().toLowerCase() !== "false";
}

function assistantDiagnostic(error?: unknown) {
  const message = error instanceof Error ? error.message : cleanText(error, 240);
  return {
    ai_enabled: assistantAiEnabled(),
    has_openai_key: Boolean(env("OPENAI_API_KEY")),
    openai_model: env("OPENAI_MODEL") || DEFAULT_MODEL,
    error_hint: message ? cleanText(message, 240) : "",
  };
}

function fallbackReasonForError(error: unknown): string {
  const message = error instanceof Error ? error.message : cleanText(error, 300);
  if (message.includes("OPENAI_API_KEY missing")) return "openai_key_missing";
  if (message.includes("ASSISTANT_ENABLED is false")) return "assistant_disabled";
  if (message.includes("assistant model unavailable")) return "openai_model_unavailable";
  return "token_or_endpoint_fallback";
}

function fallbackReply(payload: AssistantPayload, fallback_reason = "token_or_endpoint_fallback") {
  const text = normalizeMessages(payload).map((m) => m.content).join(" ").toLowerCase();
  const eplanMacro = ["eplan", "makro", "macro", "data portal", "pro panel"].some((term) => text.includes(term));
  const reply = eplanMacro
    ? "Ja, Herr Dietz kann EPLAN-/Makro-Themen grundsätzlich einordnen: EPLAN P8, Artikel-/BMK-Struktur, Klemmen, Kabel, Stücklisten und Schaltschrankbau-Unterlagen gehören zu seinem praktischen Umfeld. Ob ein konkreter Makrotyp, Data-Portal-Daten, Pro-Panel-3D-Makros oder eine kundenspezifische Bibliothek sinnvoll sind, sollte Herr Dietz anhand des Projektstands prüfen."
    : "Ich kann die Anfrage fachlich grob strukturieren und an Herrn Dietz zur persönlichen Prüfung weitergeben. Für eine erste Einschätzung reichen Maschine/Anlage, aktueller Dokumentationsstand, gewünschte Unterstützung und Zeitraum.";
  return {
    reply,
    mode: "fallback",
    fallback_reason,
    intent: eplanMacro ? "eplan_macro_trust_question" : "project_triage",
    requires_human: true,
    escalation_reason: "review_required_personal_patrick",
    diagnostic: assistantDiagnostic(),
  };
}

function unavailableReply(error: unknown, fallback_reason = fallbackReasonForError(error)) {
  return {
    ok: false,
    reply: "Aria-KI ist aktuell nicht erreichbar. Bitte versuchen Sie es gleich erneut oder holen Sie Herrn Dietz über die Übergabe dazu.",
    mode: "ai_unavailable",
    fallback_reason,
    requires_human: true,
    escalation_reason: "ai_unavailable",
    diagnostic: assistantDiagnostic(error),
  };
}

async function callOpenAI(payload: AssistantPayload) {
  if (!assistantAiEnabled()) throw new Error("ASSISTANT_ENABLED is false");
  const apiKey = env("OPENAI_API_KEY")
    .replace(/[\s"'`]/g, "")
    .trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const aiPayload = sanitizePayloadForAi(payload);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env("OPENAI_MODEL") || DEFAULT_MODEL,
      input: [
        { role: "system", content: systemPrompt(cleanText(aiPayload.language, 8) || "de") },
        { role: "user", content: contextPrompt(aiPayload.context || {}) },
        ...normalizeMessages(aiPayload),
      ],
      max_output_tokens: 700,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "assistant model unavailable");
  const outputText = data.output_text || data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || []).find((item: { text?: string }) => item.text)?.text;
  return {
    reply: cleanText(outputText, 2400) || fallbackReply(payload).reply,
    mode: "live_ai",
    requires_human: true,
    escalation_reason: "review_required_personal_patrick",
  };
}

function formatLead(payload: AssistantPayload, result: Record<string, unknown>, sessionId = "", operatorUrl = "") {
  const customer = payload.customer || {};
  const context = payload.context || {};
  return [
    "Neue DIETZ Website-Anfrage / Aria Projektassistenz",
    "Operator-Kanal: private Telegram-Gruppe",
    "",
    `Name: ${cleanText(customer.name, 160) || "nicht angegeben"}`,
    `Kontakt: ${cleanText(customer.contact, 220) || "nicht angegeben"}`,
    `Sprache: ${cleanText(payload.language, 16) || "de"}`,
    "",
    `Projekttyp: ${cleanText(context.project_type, 180) || "nicht angegeben"}`,
    `Maschine/Anlage: ${cleanText(context.machine, 220) || "nicht angegeben"}`,
    `Zeitrahmen: ${cleanText(context.timeline, 160) || "nicht angegeben"}`,
    `Kurzbeschreibung: ${cleanText(context.scope, 1200) || "nicht angegeben"}`,
    "",
    `Frage: ${normalizeMessages(payload).map((m) => m.content).join(" | ") || "nicht angegeben"}`,
    "",
    `Status: Herr-Dietz-Review angefordert (${cleanText(result.mode, 80) || "handoff"})`,
    sessionId ? `Chat-Session: ${sessionId}` : "",
    operatorUrl ? `Antwort an Chat: ${operatorUrl}` : "",
    "",
    "Herr Dietz prüft verbindliche Fragen persönlich.",
  ].join("\n");
}

async function notifyTelegram(text: string) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return { ok: false, skipped: true };
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900), disable_web_page_preview: true }),
  });
  return response.json().catch(() => ({ ok: response.ok, status: response.status }));
}

function escapeHtml(value: unknown): string {
  return cleanText(value, 4000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanupOperatorSessions() {
  const now = Date.now();
  for (const [sessionId, session] of operatorSessions.entries()) {
    if (now - session.createdAt > OPERATOR_SESSION_TTL_MS) operatorSessions.delete(sessionId);
  }
}

async function saveOperatorSession(sessionId: string, session: OperatorSession) {
  operatorSessions.set(sessionId, session);
  try {
    const response = await supabaseRest("assistant_operator_sessions", {
      method: "POST",
      headers: { "prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({
        session_id: sessionId,
        token: session.token,
        next_id: session.nextId,
        created_at: new Date(session.createdAt).toISOString(),
        expires_at: new Date(session.createdAt + OPERATOR_SESSION_TTL_MS).toISOString(),
      }),
    });
    if (!response.ok) throw new Error(`session_save_failed_${response.status}`);
  } catch (_) {
    // Fallback keeps local development working; production uses Supabase DB for cross-isolate persistence.
  }
}

async function loadOperatorSession(sessionId: string): Promise<OperatorSession | null> {
  cleanupOperatorSessions();
  if (!sessionId) return null;
  try {
    const response = await supabaseRest(`assistant_operator_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=session_id,token,next_id,created_at,expires_at&limit=1`);
    if (response.ok) {
      const rows = await response.json().catch(() => []);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && (!row.expires_at || Date.parse(row.expires_at) > Date.now())) {
        const session = {
          token: cleanText(row.token, 120),
          replies: [],
          nextId: Number(row.next_id || 1),
          createdAt: Date.parse(row.created_at) || Date.now(),
        };
        operatorSessions.set(sessionId, session);
        return session;
      }
    }
  } catch (_) {}
  return operatorSessions.get(sessionId) || null;
}

async function loadOperatorReplies(sessionId: string, after = 0): Promise<OperatorReply[]> {
  try {
    const response = await supabaseRest(`assistant_operator_replies?session_id=eq.${encodeURIComponent(sessionId)}&reply_id=gt.${Number(after) || 0}&select=reply_id,action,message,created_at&order=reply_id.asc`);
    if (response.ok) {
      const rows = await response.json().catch(() => []);
      if (Array.isArray(rows)) return rows.map((row) => ({
        id: Number(row.reply_id || 0),
        action: cleanText(row.action, 80) || "operator_reply",
        message: cleanText(row.message, 1200),
        created_at: cleanText(row.created_at, 80),
      })).filter((reply) => reply.id > 0 && reply.message);
    }
  } catch (_) {}
  const session = operatorSessions.get(sessionId);
  return session ? session.replies.filter((reply) => reply.id > after) : [];
}

async function appendOperatorMessage(sessionId: string, role: string, message: string) {
  const safeRole = cleanText(role, 40) || "customer";
  const safeMessage = cleanText(message, 1400);
  if (!sessionId || !safeMessage) return { ok: false, skipped: true };
  try {
    const response = await supabaseRest("assistant_operator_messages", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, role: safeRole, message: safeMessage, created_at: new Date().toISOString() }),
    });
    return { ok: response.ok, status: response.status };
  } catch (_) {
    return { ok: false, skipped: true };
  }
}

async function loadOperatorMessages(sessionId: string, after = 0): Promise<OperatorMessage[]> {
  try {
    const response = await supabaseRest(`assistant_operator_messages?session_id=eq.${encodeURIComponent(sessionId)}&id=gt.${Number(after) || 0}&select=id,role,message,created_at&order=id.asc`);
    if (response.ok) {
      const rows = await response.json().catch(() => []);
      if (Array.isArray(rows)) return rows.map((row) => ({
        id: Number(row.id || 0),
        role: cleanText(row.role, 40),
        message: cleanText(row.message, 1400),
        created_at: cleanText(row.created_at, 80),
      })).filter((item) => item.id > 0 && item.message);
    }
  } catch (_) {}
  return [];
}

function operatorInitialMessage(payload: AssistantPayload) {
  const context = payload.context || {};
  return [
    cleanText(payload.customer?.name, 140) ? `Name: ${cleanText(payload.customer?.name, 140)}` : "",
    cleanText(payload.customer?.contact, 180) ? `Kontakt: ${cleanText(payload.customer?.contact, 180)}` : "",
    cleanText(context.project_type, 220) ? `Projekttyp: ${cleanText(context.project_type, 220)}` : "",
    cleanText(context.machine, 260) ? `Maschine/Anlage: ${cleanText(context.machine, 260)}` : "",
    cleanText(context.timeline, 180) ? `Zeitrahmen: ${cleanText(context.timeline, 180)}` : "",
    cleanText(context.scope, 1200) ? `Kurzbeschreibung: ${cleanText(context.scope, 1200)}` : "",
    normalizeMessages(payload).map((m) => m.content).join(" | ") ? `Frage: ${normalizeMessages(payload).map((m) => m.content).join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

async function appendOperatorReply(sessionId: string, session: OperatorSession, message: string): Promise<number> {
  const replyId = session.nextId++;
  const reply = { id: replyId, action: "operator_reply", message, created_at: new Date().toISOString() };
  session.replies.push(reply);
  operatorSessions.set(sessionId, session);
  try {
    await supabaseRest("assistant_operator_replies", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, reply_id: reply.id, action: reply.action, message: reply.message, created_at: reply.created_at }),
    });
    await supabaseRest(`assistant_operator_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ next_id: session.nextId }),
    });
  } catch (_) {}
  await appendOperatorMessage(sessionId, "patrick", message);
  return replyId;
}

async function createOperatorSession() {
  cleanupOperatorSessions();
  const sessionId = crypto.randomUUID();
  const token = crypto.randomUUID().replace(/-/g, "");
  const session = { token, replies: [], nextId: 1, createdAt: Date.now() };
  await saveOperatorSession(sessionId, session);
  return { sessionId, token };
}

function publicFunctionOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol === "http:" ? "https:" : url.protocol}//${url.host}`;
}

function operatorBaseUrl(request: Request) {
  const url = new URL(request.url);
  const canonicalFunctionPath = "/functions/v1/assistant";
  const normalizedPath = url.pathname.replace(/\/?(?:lead|escalate|replies|operator\/(?:ui|reply))?$/, "").replace(/\/$/, "");
  const origin = publicFunctionOrigin(request);
  if (normalizedPath.endsWith(canonicalFunctionPath)) return `${origin}${normalizedPath}`;
  return `${origin}${canonicalFunctionPath}`;
}

function operatorPublicUiUrl(sessionId: string, token: string) {
  const configured = env("OPERATOR_UI_BASE_URL") || "https://dietz-engineering.com/operator-reply/";
  const base = configured.replace(/\/$/, "/");
  return `${base}?session_id=${encodeURIComponent(sessionId)}&operator_token=${encodeURIComponent(token)}`;
}

function operatorUiHtml(sessionId: string, token: string, actionUrl: string, notice = "") {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIETZ Operator Antwort</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:2rem;max-width:760px;line-height:1.5;background:#0d1320;color:#f5f7fb}textarea{width:100%;min-height:9rem;border-radius:14px;border:1px solid #39445c;background:#111a2d;color:#f5f7fb;padding:1rem;font:inherit}button{margin-top:1rem;border:0;border-radius:999px;padding:.85rem 1.25rem;background:#f0c36a;color:#17120a;font-weight:700}.notice{padding:1rem;border-radius:14px;background:#16233a;margin-bottom:1rem}.muted{color:#aeb8ce}</style></head><body><h1>Antwort an Website-Chat</h1>${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}<form method="post" action="${escapeHtml(actionUrl)}"><input type="hidden" name="session_id" value="${escapeHtml(sessionId)}"><input type="hidden" name="operator_token" value="${escapeHtml(token)}"><label for="message">Nachricht von Herrn Dietz</label><textarea id="message" name="message" autofocus required placeholder="Antwort für den Website-Besucher ..."></textarea><br><button type="submit">Antwort senden</button></form><p class="muted">Die Antwort wird in den aktuellen Website-Chat gelegt. Dieser Kurzzeit-Kanal läuft automatisch ab.</p></body></html>`;
}

function parseFormBody(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

function getRequestPayload(request: Request, raw: string): Record<string, unknown> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) return parseFormBody(raw);
  try { return JSON.parse(raw); } catch { return {}; }
}

async function handleChat(request: Request, payload: AssistantPayload, headers: Record<string, string>) {
  const limited = rateLimit(request);
  let result: Record<string, unknown>;
  if (!limited.ok) {
    result = unavailableReply(new Error(limited.fallback_reason || "rate_limit_fallback"), limited.fallback_reason || "rate_limit_fallback");
  } else {
    try { result = await callOpenAI(payload); }
    catch (error) {
      result = unavailableReply(error);
    }
  }
  return jsonResponse(result, result.mode === "live_ai" ? 200 : 503, headers);
}

async function handleReplies(request: Request, headers: Record<string, string>) {
  const url = new URL(request.url);
  const sessionId = cleanText(url.searchParams.get("session_id"), 120);
  const after = Number(url.searchParams.get("after") || 0);
  const session = await loadOperatorSession(sessionId);
  if (!session) return jsonResponse({ ok: true, replies: [], next: after || 0, expired: true }, 200, headers);
  const replies = await loadOperatorReplies(sessionId, after);
  const next = replies.length ? replies[replies.length - 1].id : after || 0;
  return jsonResponse({ ok: true, replies, next }, 200, headers);
}

async function handleOperatorUi(request: Request, headers: Record<string, string>) {
  const url = new URL(request.url);
  const sessionId = cleanText(url.searchParams.get("session_id"), 120);
  const token = cleanText(url.searchParams.get("operator_token"), 120);
  const session = await loadOperatorSession(sessionId);
  const base = operatorBaseUrl(request);
  const actionUrl = `${base}/operator/reply`;
  if (!session || session.token !== token) {
    return htmlResponse(operatorUiHtml(sessionId, token, actionUrl, "Dieser Antwort-Link ist abgelaufen oder ungültig."), 200, headers);
  }
  return htmlResponse(operatorUiHtml(sessionId, token, actionUrl), 200, headers);
}

async function handleOperatorMessages(request: Request, headers: Record<string, string>) {
  const url = new URL(request.url);
  const sessionId = cleanText(url.searchParams.get("session_id"), 120);
  const token = cleanText(url.searchParams.get("operator_token"), 120);
  const after = Number(url.searchParams.get("after") || 0);
  const session = await loadOperatorSession(sessionId);
  if (!session || session.token !== token) return jsonResponse({ ok: false, error: "invalid_or_expired_operator_session", messages: [] }, 404, headers);
  const messages = await loadOperatorMessages(sessionId, after);
  const next = messages.length ? messages[messages.length - 1].id : after || 0;
  return jsonResponse({ ok: true, messages, next }, 200, headers);
}


function parseOperatorReviewJson(value: string): Partial<OperatorReview> {
  try { return JSON.parse(value); } catch (_) {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]); } catch (_) { return {}; }
  }
}

function operatorReviewFallback(message: string, customerText: string, language = "de"): OperatorReview {
  const target = cleanText(language, 8) || "de";
  return {
    target_language: target,
    language_label: target === "es" ? "Spanisch" : target === "zh" ? "Chinesisch" : target === "en" ? "Englisch" : "Deutsch",
    translation_for_patrick: customerText || "Keine aktuelle Kundennachricht im Verlauf.",
    corrected_message: message,
    final_message: message,
    suggestions: [
      "Guten Tag, vielen Dank für Ihre Nachricht. Ich schaue mir Ihr Anliegen gern an. Können Sie mir bitte kurz Maschine/Anlage, aktuellen Dokumentationsstand und den gewünschten Zeitraum nennen?",
      "Vielen Dank für die Informationen. Für eine erste Einordnung helfen mir Projektart, EPLAN-/Dokumentationsstand und die wichtigsten offenen Punkte.",
      "Gerne unterstütze ich Sie bei der technischen Klärung. Bitte senden Sie zunächst nur die groben Eckdaten; sensible Daten können wir danach über einen passenden Kanal abstimmen."
    ],
    review_status: "fallback_no_ai",
    notes: ["KI-Review war nicht erreichbar; Text wurde nicht übersetzt."],
  };
}

async function callOperatorReviewAI(message: string, customerText: string, language = "de"): Promise<OperatorReview> {
  if (!assistantAiEnabled()) throw new Error("ASSISTANT_ENABLED is false");
  const apiKey = env("OPENAI_API_KEY").replace(/[\s\"'`]/g, "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env("OPENAI_MODEL") || DEFAULT_MODEL,
      input: [
        { role: "system", content: [
          "Du bist der geschützte Operator-Review für Patrick Dietz / DIETZ Engineering.",
          "Korrigiere Patricks Rechtschreibung und Grammatik, ohne fachliche Zusagen zu erfinden.",
          "Erkenne die Kundensprache. Wenn der Kunde Spanish oder Chinese schreibt, übersetze für Patrick ins Deutsche und übersetze Patricks Antwort zurück in die Kundensprache.",
          "Bei Deutsch/Englisch ebenfalls Ton professionell, ruhig und kunden-facing machen.",
          "Keine Preise, festen Termine, Zertifikate, Rechts-/CE-Garantien oder Kontaktdaten erfinden.",
          "Gib ausschließlich valides JSON zurück: target_language, language_label, translation_for_patrick, corrected_message, final_message, suggestions (3 kurze Optionen), review_status, notes."
        ].join("\n") },
        { role: "user", content: JSON.stringify({ preferred_language: cleanText(language, 8) || "de", latest_customer_message: customerText, patrick_draft: message }) },
      ],
      max_output_tokens: 900,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "operator review model unavailable");
  const outputText = data.output_text || data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || []).find((item: { text?: string }) => item.text)?.text || "{}";
  const parsed = parseOperatorReviewJson(outputText);
  const fallback = operatorReviewFallback(message, customerText, language);
  return {
    target_language: cleanText(parsed.target_language, 16) || fallback.target_language,
    language_label: cleanText(parsed.language_label, 80) || fallback.language_label,
    translation_for_patrick: cleanText(parsed.translation_for_patrick, 1600) || fallback.translation_for_patrick,
    corrected_message: cleanText(parsed.corrected_message, 1600) || fallback.corrected_message,
    final_message: cleanText(parsed.final_message, 1600) || cleanText(parsed.corrected_message, 1600) || fallback.final_message,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map((item) => cleanText(item, 700)).filter(Boolean).slice(0, 3) : fallback.suggestions,
    review_status: cleanText(parsed.review_status, 80) || "ai_reviewed",
    notes: Array.isArray(parsed.notes) ? parsed.notes.map((item) => cleanText(item, 220)).filter(Boolean).slice(0, 4) : [],
  };
}

async function handleOperatorReview(request: Request, raw: string, headers: Record<string, string>) {
  const payload = getRequestPayload(request, raw);
  const sessionId = cleanText(payload.session_id, 120);
  const token = cleanText(payload.operator_token, 120);
  const message = cleanText(payload.message, 1200);
  const language = cleanText(payload.language, 8) || "de";
  const session = await loadOperatorSession(sessionId);
  if (!session || session.token !== token) return jsonResponse({ ok: false, error: "invalid_or_expired_operator_session" }, 404, headers);
  const messages = await loadOperatorMessages(sessionId, 0);
  const latestCustomer = [...messages].reverse().find((item) => item.role === "customer")?.message || "";
  const draft = message || "Guten Tag, vielen Dank für Ihre Nachricht. Ich schaue mir Ihr Anliegen gerne an.";
  try {
    const review = await callOperatorReviewAI(draft, latestCustomer, language);
    return jsonResponse({ ok: true, reviewedMessage: review.final_message, ...review }, 200, headers);
  } catch (error) {
    const review = operatorReviewFallback(draft, latestCustomer, language);
    return jsonResponse({ ok: true, reviewedMessage: review.final_message, ...review, diagnostic: assistantDiagnostic(error) }, 200, headers);
  }
}

async function handleCustomerMessage(request: Request, raw: string, headers: Record<string, string>) {
  const payload = getRequestPayload(request, raw);
  const sessionId = cleanText(payload.session_id, 120);
  const message = cleanText(payload.message, 1200);
  const language = cleanText(payload.language, 8) || "de";
  const session = await loadOperatorSession(sessionId);
  if (!session) return jsonResponse({ ok: false, error: "invalid_or_expired_operator_session" }, 404, headers);
  if (!message) return jsonResponse({ ok: false, error: "message_required" }, 400, headers);
  await appendOperatorMessage(sessionId, "customer", message);
  await notifyTelegram([
    "Neue Kundenantwort im DIETZ Website-Chat",
    "Operator-Kanal: private Telegram-Gruppe",
    `Sprache: ${language}`,
    `Chat-Session: ${sessionId}`,
    `Nachricht: ${message}`,
    `Antwort an Chat: ${operatorPublicUiUrl(sessionId, session.token)}`,
  ].join("\n"));
  return jsonResponse({ ok: true, delivered: true, session_id: sessionId }, 200, headers);
}

async function handleOperatorReply(request: Request, raw: string, headers: Record<string, string>) {
  const payload = getRequestPayload(request, raw);
  const sessionId = cleanText(payload.session_id, 120);
  const token = cleanText(payload.operator_token, 120);
  const message = cleanText(payload.message, 1200);
  const session = await loadOperatorSession(sessionId);
  if (!session || session.token !== token) return jsonResponse({ ok: false, error: "invalid_or_expired_operator_session" }, 404, headers);
  if (!message) return jsonResponse({ ok: false, error: "message_required" }, 400, headers);
  const next = await appendOperatorReply(sessionId, session, message);
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html") && !(request.headers.get("accept") || "").includes("application/json");
  if (acceptsHtml) {
    return htmlResponse(operatorUiHtml(sessionId, token, `${operatorBaseUrl(request)}/operator/reply`, "Antwort wurde an den Website-Chat übergeben."), 200, headers);
  }
  return jsonResponse({ ok: true, delivered: true, session_id: sessionId, next }, 200, headers);
}

async function handleLead(request: Request, payload: AssistantPayload, headers: Record<string, string>) {
  if (payload.confirmed !== true) {
    return jsonResponse({ error: "handoff requires confirmed consent" }, 400, headers);
  }
  const limited = rateLimit(request);
  if (!limited.ok) return jsonResponse({ ok: false, fallback_reason: limited.fallback_reason }, 429, headers);
  const result = fallbackReply(payload, payload.fallback_reason || "confirmed_handoff");
  const { sessionId, token } = await createOperatorSession();
  await appendOperatorMessage(sessionId, "customer", operatorInitialMessage(payload));
  const replyUrl = operatorPublicUiUrl(sessionId, token);
  const telegram = await notifyTelegram(formatLead(payload, result, sessionId, replyUrl));
  return jsonResponse({ ok: true, delivered: !telegram.skipped, telegram, fallback_reason: result.fallback_reason, session_id: sessionId, operator_token: token, reply_url: replyUrl }, 200, headers);
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: isOriginAllowed(request) ? 204 : 403, headers });
  if (!isOriginAllowed(request)) return jsonResponse({ error: "origin not allowed" }, 403, headers);
  const pathname = new URL(request.url).pathname;
  if (request.method === "GET") {
    if (pathname.endsWith("/replies")) return await handleReplies(request, headers);
    if (pathname.endsWith("/operator/messages")) return await handleOperatorMessages(request, headers);
    if (pathname.endsWith("/operator/ui")) return await handleOperatorUi(request, headers);
    return jsonResponse({ error: "method not allowed" }, 405, headers);
  }
  if (request.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405, headers);
  const raw = await request.text();
  if (pathname.endsWith("/operator/review")) return await handleOperatorReview(request, raw, headers);
  if (pathname.endsWith("/operator/reply")) return await handleOperatorReply(request, raw, headers);
  if (pathname.endsWith("/operator/customer-message")) return await handleCustomerMessage(request, raw, headers);
  let payload: AssistantPayload | null = null;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  if (!payload) return jsonResponse({ error: "invalid json" }, 400, headers);
  if (pathname.endsWith("/lead") || pathname.endsWith("/escalate")) return await handleLead(request, payload, headers);
  return await handleChat(request, payload, headers);
});
