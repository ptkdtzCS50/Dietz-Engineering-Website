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

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function env(name: string): string {
  return Deno.env.get(name) || "";
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
    "access-control-allow-methods": "POST, OPTIONS",
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
    "You are Aria, the DIETZ project assistant for Patrick Dietz.",
    `Answer in the user's language when possible. Preferred language: ${cleanText(language, 8)}.`,
    "Purpose: build trust by answering first technical questions honestly and concretely, not by overselling.",
    "Patrick Dietz supports freelance electrical engineering for machine and plant builders: EPLAN P8 schematics, macro/article/BMK structure, terminals, cables, BOM consistency, panel-building documentation, Pro Panel/Smartwiring context, installation, commissioning, retrofit troubleshooting, and structured project handover.",
    "For EPLAN macros: say Patrick can generally help assess existing structures, prepare project-suitable macros, and build reusable standards, but the concrete macro type, Data Portal data, Pro Panel 3D macro, and customer library must be checked from the project context.",
    "Never claim certifications, guaranteed CE/Safety/legal compliance, fixed prices, fixed delivery dates, or final engineering release.",
    "Never invent email addresses, phone numbers, employee counts, customer names, references, discounts, hourly rates, or other contact/company facts. If a contact route is needed, refer to the official website contact details or the website handoff form only.",
    "Do not promise a callback time, same-day response, or any concrete response time. You may say Patrick checks customer inquiries personally and a handoff can be prepared.",
    "Do not say you cannot contact Patrick directly. Instead: explain that the website can prepare a handoff to Patrick via the private Telegram operator channel after explicit consent and sufficient contact/project details.",
    "Never ask for passwords, secrets, complete confidential schematics, EPLAN projects, or internal customer files in chat. Recommend a suitable secure channel after first contact.",
    "For handoff requests: ask for name, preferred contact route, topic, urgency, and explicit consent; warn that sensitive project files should wait for an agreed secure channel.",
    "Patrick prüft verbindliche Fragen persönlich.",
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
    ? "Ja, Patrick kann EPLAN-/Makro-Themen grundsätzlich einordnen: EPLAN P8, Artikel-/BMK-Struktur, Klemmen, Kabel, Stücklisten und Schaltschrankbau-Unterlagen gehören zu seinem praktischen Umfeld. Ob ein konkreter Makrotyp, Data-Portal-Daten, Pro-Panel-3D-Makros oder eine kundenspezifische Bibliothek sinnvoll sind, sollte Patrick anhand des Projektstands prüfen. Bitte keine vertraulichen EPLAN-Projekte direkt im Chat senden."
    : "Ich kann die Anfrage fachlich grob strukturieren und an Patrick zur persönlichen Prüfung weitergeben. Für eine erste Einschätzung reichen Maschine/Anlage, aktueller Dokumentationsstand, gewünschte Unterstützung und Zeitraum. Bitte keine vertraulichen Projektdateien direkt im Chat senden.";
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
    reply: "Aria-KI ist aktuell nicht erreichbar. Bitte versuchen Sie es gleich erneut oder holen Sie Patrick über die Übergabe dazu.",
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

function formatLead(payload: AssistantPayload, result: Record<string, unknown>) {
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
    `Status: Patrick-Review angefordert (${cleanText(result.mode, 80) || "handoff"})`,
    "",
    "Patrick prüft verbindliche Fragen persönlich.",
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

async function handleLead(request: Request, payload: AssistantPayload, headers: Record<string, string>) {
  if (payload.confirmed !== true) {
    return jsonResponse({ error: "handoff requires confirmed consent" }, 400, headers);
  }
  const limited = rateLimit(request);
  if (!limited.ok) return jsonResponse({ ok: false, fallback_reason: limited.fallback_reason }, 429, headers);
  const result = fallbackReply(payload, payload.fallback_reason || "confirmed_handoff");
  const telegram = await notifyTelegram(formatLead(payload, result));
  return jsonResponse({ ok: true, delivered: !telegram.skipped, telegram, fallback_reason: result.fallback_reason }, 200, headers);
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: isOriginAllowed(request) ? 204 : 403, headers });
  if (!isOriginAllowed(request)) return jsonResponse({ error: "origin not allowed" }, 403, headers);
  if (request.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405, headers);
  const payload = await readJson(request);
  if (!payload) return jsonResponse({ error: "invalid json" }, 400, headers);
  const pathname = new URL(request.url).pathname;
  if (pathname.endsWith("/lead") || pathname.endsWith("/escalate")) return await handleLead(request, payload, headers);
  return await handleChat(request, payload, headers);
});
