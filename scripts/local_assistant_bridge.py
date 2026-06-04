#!/usr/bin/env python3
"""Local-only DIETZ website assistant bridge.

Accepts browser POSTs from the local static website and forwards the lead
notification to Patrick's configured Hermes Telegram home channel.

This is intentionally a development bridge:
- binds to 127.0.0.1 only
- no public tunnel
- no AI/provider calls
- no secrets in frontend config
"""

from __future__ import annotations

import html
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, cast
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

HOST = "127.0.0.1"
PORT = int(os.getenv("DIETZ_ASSISTANT_BRIDGE_PORT", "8790"))
TARGET = os.getenv("DIETZ_ASSISTANT_BRIDGE_TARGET", "telegram")
REMOTE_ASSISTANT_ENDPOINT = os.getenv("DIETZ_REMOTE_ASSISTANT_ENDPOINT", "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant")
MAX_BODY_BYTES = 32_768
SESSIONS_PATH = Path(os.getenv("DIETZ_ASSISTANT_SESSIONS_PATH", "/tmp/dietz_assistant_sessions.json"))


def _load_sessions() -> dict[str, Any]:
    if not SESSIONS_PATH.exists():
        return {}
    try:
        data = json.loads(SESSIONS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_sessions(sessions: dict[str, Any]) -> None:
    SESSIONS_PATH.write_text(json.dumps(sessions, ensure_ascii=False, indent=2), encoding="utf-8")


def _new_session_id() -> str:
    return f"dietz-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"

HERMES_SOURCE = Path.home() / ".hermes" / "hermes-agent"
if str(HERMES_SOURCE) not in sys.path:
    sys.path.insert(0, str(HERMES_SOURCE))


def _load_hermes_env() -> None:
    env_path = Path.home() / ".hermes" / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_hermes_env()


def _clean(value: Any, max_len: int = 900) -> str:
    text = " ".join(str(value or "").split())
    return text[:max_len]


def _reply_url(session_id: str) -> str:
    return f"http://{HOST}:{PORT}/operator/ui?session_id={quote(session_id)}"

def _html_page(title: str, body: str) -> bytes:
    return f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>
    :root {{ color-scheme: dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #071018; color: #eef6ff; }}
    body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem; background: radial-gradient(circle at top left, rgba(43, 212, 255, .18), transparent 34%), #071018; }}
    main {{ width: min(760px, 100%); background: rgba(12, 24, 36, .94); border: 1px solid rgba(142, 209, 255, .22); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,.45); padding: clamp(1rem, 4vw, 2rem); }}
    h1 {{ margin: 0 0 .25rem; font-size: clamp(1.5rem, 5vw, 2.2rem); }}
    .meta, .hint {{ color: #a9bfd1; }}
    .bubble {{ background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 1rem; margin: 1rem 0; white-space: pre-wrap; }}
    label {{ display:block; font-weight: 700; margin: 1rem 0 .45rem; }}
    textarea {{ width: 100%; box-sizing: border-box; min-height: 150px; border-radius: 16px; border: 1px solid rgba(142, 209, 255, .32); background: rgba(3, 8, 14, .86); color: #fff; padding: 1rem; font: inherit; resize: vertical; }}
    .actions {{ display:flex; gap:.75rem; flex-wrap:wrap; margin-top:1rem; }}
    button, a.button {{ border: 0; border-radius: 999px; padding: .9rem 1.25rem; background: linear-gradient(135deg,#7dd3fc,#2dd4bf); color:#021018; font-weight:800; cursor:pointer; text-decoration:none; }}
    button.secondary {{ background: rgba(255,255,255,.12); color:#eef6ff; border:1px solid rgba(255,255,255,.16); }}
    code {{ color:#7dd3fc; }}
  </style>
</head>
<body><main>{body}</main></body>
</html>""".encode("utf-8")


LANGUAGE_LABELS = {"de": "Deutsch", "es": "Spanisch", "zh": "Chinesisch", "en": "Englisch", "unknown": "unbekannt"}


def detect_message_language(text: str) -> str:
    lower = (text or "").strip().lower()
    if any("\u4e00" <= char <= "\u9fff" for char in lower):
        return "zh"
    spanish_markers = ["¿", "¡", "ñ", "á", "é", "í", "ó", "ú", " hola ", " hole ", " tengo ", " una ", " pregunta ", " para ", " necesito ", " esquema ", " máquina ", " cuanto ", " cuesta "]
    if any(marker in f" {lower} " for marker in spanish_markers):
        return "es"
    english_markers = [" the ", " and ", " with ", " need ", "hello", "how "]
    if any(marker in f" {lower} " for marker in english_markers):
        return "en"
    return "de" if lower else "unknown"


def translate_for_patrick(message: str, source_language: str) -> tuple[str, str]:
    if source_language in {"de", "unknown"}:
        return message, "original_de_or_unknown"
    return f"[Übersetzung für Herrn Dietz noch nicht lokal verfügbar — Original {LANGUAGE_LABELS.get(source_language, source_language)}:] {message}", "translation_engine_missing"


def correct_german_grammar(message: str) -> tuple[str, list[str]]:
    corrected = message or ""
    replacements = {
        "Guten tag": "Guten Tag",
        "guten tag": "Guten Tag",
        "wieviele": "wie viele",
        "Wieviele": "Wie viele",
        "udn": "und",
        "sämmtliche": "sämtliche",
        "Sämmtliche": "Sämtliche",
        "Farge": "Frage",
        "farge": "Frage",
        "Schaltplan Erstelllung": "Schaltplanerstellung",
        "Eplan": "EPLAN",
        "eplan": "EPLAN",
    }
    changes = []
    for old, new in replacements.items():
        if old in corrected:
            corrected = corrected.replace(old, new)
            changes.append(f"{old} → {new}")
    return corrected.strip(), changes


def translate_from_patrick(message: str, target_language: str) -> tuple[str, str]:
    if target_language in {"de", "unknown", ""}:
        return message, "target_de_or_unknown"
    return message, "review_required_translation_engine_missing"


def prepare_operator_reply(message: str, target_language: str) -> dict[str, Any]:
    source_language = detect_message_language(message)
    corrected_message, correction_notes = correct_german_grammar(message)
    translated_message, translation_status = translate_from_patrick(corrected_message, target_language)
    return {
        "source_language": source_language,
        "target_language": target_language or "de",
        "corrected_message": corrected_message,
        "correction_notes": correction_notes,
        "translated_message": translated_message,
        "translation_status": translation_status,
    }


def _format_message(payload: dict[str, Any], session_id: str | None = None) -> str:
    context = cast(dict[str, Any], payload.get("context") if isinstance(payload.get("context"), dict) else {})
    customer = cast(dict[str, Any], payload.get("customer") if isinstance(payload.get("customer"), dict) else {})

    question = _clean(payload.get("question") or context.get("question"), 900)
    project_type = _clean(context.get("project_type"), 180)
    machine = _clean(context.get("machine"), 180)
    scope = _clean(context.get("scope"), 900)
    timeline = _clean(context.get("timeline"), 180)
    name = _clean(customer.get("name") or context.get("contact_name"), 180)
    contact = _clean(customer.get("contact") or context.get("contact_contact"), 220)
    lang = _clean(payload.get("language"), 20) or "de"
    fallback_reason = _clean(payload.get("fallback_reason"), 120)

    lines = [
        "🔔 DIETZ Website-Chat — neue lokale Testanfrage",
        "",
        f"Zeit: {datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}",
        f"Sprache: {lang}",
    ]
    if question:
        lines += ["", f"Frage: {question}"]
    if project_type or machine or scope or timeline:
        lines += ["", "Einordnung:"]
        if project_type:
            lines.append(f"- Typ: {project_type}")
        if machine:
            lines.append(f"- Maschine/Anlage: {machine}")
        if scope:
            lines.append(f"- Bedarf: {scope}")
        if timeline:
            lines.append(f"- Zeitrahmen: {timeline}")
    if name or contact:
        lines += ["", "Kontakt:"]
        if name:
            lines.append(f"- Name: {name}")
        if contact:
            lines.append(f"- Kontakt: {contact}")
    if fallback_reason:
        lines += ["", f"Status: {fallback_reason}"]
    if session_id:
        lines += [
            "",
            f"Chat-Session: {session_id}",
            "",
            "Antwort lokal senden:",
            f"[Antworten öffnen]({_reply_url(session_id)})",
            f"Antwort an Chat {session_id}: <Ihre Nachricht>",
        ]
    lines += ["", "Operator-Optionen vorbereitet: Chat jetzt starten · Aria antworten lassen · Chat beenden"]
    return "\n".join(lines)



def _format_customer_followup(payload: dict[str, Any], session_id: str) -> str:
    context = cast(dict[str, Any], payload.get("context") if isinstance(payload.get("context"), dict) else {})
    message = _clean(payload.get("message"), 1200)
    customer_language = detect_message_language(message)
    translated_for_patrick, translation_status = translate_for_patrick(message, customer_language)
    machine = _clean(context.get("machine"), 180)
    scope = _clean(context.get("scope"), 900)
    timeline = _clean(context.get("timeline"), 180)
    name = _clean(context.get("contact_name"), 180)
    contact = _clean(context.get("contact_contact"), 220)
    lines = [
        "💬 DIETZ Website-Chat — Kundennachricht im laufenden Chat",
        "",
        f"Zeit: {datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}",
        f"Chat-Session: {session_id}",
        "",
        f"Kunde: {message}",
        f"Sprache erkannt: {LANGUAGE_LABELS.get(customer_language, customer_language)}",
    ]
    if customer_language not in {"de", "unknown"}:
        lines += ["", f"Übersetzung für Herrn Dietz: {translated_for_patrick}", f"Übersetzungsstatus: {translation_status}"]
    details = []
    if name: details.append(f"Name: {name}")
    if contact: details.append(f"Kontakt: {contact}")
    if machine: details.append(f"Maschine/Anlage: {machine}")
    if scope: details.append(f"Bedarf: {scope}")
    if timeline: details.append(f"Zeitrahmen: {timeline}")
    if details:
        lines += ["", "Aktueller Kontext:", *[f"- {item}" for item in details]]
    lines += [
        "",
        "Direkt antworten:",
        f"[Antworten öffnen]({_reply_url(session_id)})",
        f"Antwort an Chat {session_id}: <Ihre Nachricht>",
        "",
        "Chat beenden:",
        f"Antwort an Chat {session_id}: <Chat beenden: Ihre Abschlussnachricht>",
    ]
    return "\n".join(lines)

def _send_to_telegram(message: str) -> dict[str, Any]:
    from tools.send_message_tool import send_message_tool  # type: ignore[import-not-found]

    raw = send_message_tool({"action": "send", "target": TARGET, "message": message})
    try:
        data = json.loads(raw)
    except Exception:
        data = {"raw": raw}
    if isinstance(data, dict) and data.get("error"):
        return {"ok": False, "error": data["error"]}
    return {"ok": True, "delivery": data}


def _proxy_remote_assistant(raw_body: str, path_suffix: str = "") -> tuple[int, dict[str, Any]]:
    endpoint = REMOTE_ASSISTANT_ENDPOINT.rstrip("/") + path_suffix
    request = Request(
        endpoint,
        data=raw_body.encode("utf-8"),
        headers={"Content-Type": "application/json", "Origin": "https://dietz-engineering.com"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=18) as response:
            raw = response.read().decode("utf-8", errors="replace")
            status = int(response.status)
    except Exception as exc:
        return 502, {"ok": False, "mode": "proxy_error", "error": str(exc)[:300]}
    try:
        data = json.loads(raw)
    except Exception:
        data = {"ok": status < 400, "raw": raw}
    if isinstance(data, dict) and data.get("mode") == "fallback":
        return 503, {
            "ok": False,
            "mode": "ai_unavailable",
            "fallback_reason": data.get("fallback_reason", "remote_ai_fallback"),
            "reply": "Aria-KI ist aktuell nicht erreichbar. Bitte versuchen Sie es gleich erneut oder holen Sie Patrick über die Übergabe dazu.",
            "diagnostic": data.get("diagnostic", {}),
        }
    return status, data if isinstance(data, dict) else {"ok": status < 400, "data": data}


def _latest_user_message(payload: dict[str, Any]) -> str:
    messages = payload.get("messages")
    if isinstance(messages, list):
        for item in reversed(messages):
            if isinstance(item, dict) and item.get("role") == "user":
                return _clean(item.get("content"), 1200)
    return _clean(payload.get("question"), 1200)


def _local_chat_fallback(payload: dict[str, Any], remote_fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    context = cast(dict[str, Any], payload.get("context") if isinstance(payload.get("context"), dict) else {})
    message = _latest_user_message(payload)
    lower = message.lower()
    normalized = lower.replace("reviw", "review").replace("reviev", "review").replace("e-plan", "eplan")
    name = _clean(context.get("contact_name"), 80)
    prefix = f"{name}, " if name else ""

    if any(term in normalized for term in ["wetter", "temperatur", "regen", "sonne", "vorhersage"]):
        reply = (
            f"{prefix}zum Wetter kann ich hier nicht sinnvoll helfen. Ich bin für Fragen zu Patrick Dietz, DIETZ Engineering, EPLAN/Elektrokonstruktion, Projektunterstützung und Handoff an Patrick gedacht."
        )
    elif any(term in normalized for term in ["mitarbeiter", "team", "angestellte", "wie viele leute", "wie viele personen", "firma groß", "firma gross"]):
        reply = (
            f"{prefix}DIETZ Engineering ist als direkter Spezialistenkontakt rund um Patrick Dietz positioniert, nicht als große Agentur. "
            "Für Ihr Projekt bedeutet das: kurze Wege, klare Verantwortung und direkte Abstimmung mit Patrick."
        )
    elif any(term in normalized for term in ["werdegang", "ausbildung", "techniker", "lebenslauf", "cv", "zuletzt gearbeitet", "letzte arbeit", "wo hat patrick", "wo arbeitete patrick", "berufserfahrung"]):
        reply = (
            f"{prefix}Patricks Werdegang kommt aus der Praxis im Maschinen- und Anlagenbau: Elektroniker für Betriebstechnik, später staatlich geprüfter Techniker Elektrotechnik. "
            "Er hat Erfahrung aus Lager/Arbeitsvorbereitung, Schaltschrankbau, VDE-Messungen, Montage, Installation, Inbetriebnahme, Lieferantenabklärung und Projektabstimmung. "
            "Auf der Website sind u. a. Projektstationen bei Breyer Maschinenfabrik von 2015 bis 2022 sowie internationale Inbetriebnahmen und EPLAN-Projekte genannt; vertrauliche aktuelle Kunden nennt Aria nicht im Chat."
        )
    elif any(term in normalized for term in ["was kannst", "was kann patrick", "was macht patrick", "wobei kann patrick", "wobei kannst", "wie kannst", "helfen", "unterstützung", "unterstuetzung"]):
        reply = (
            f"{prefix}Patrick kann vor allem bei Elektrokonstruktion und EPLAN-Projekten unterstützen: "
            "EPLAN P8, Pro Panel, Makros, Artikel-/BMK-Struktur, Klemmen, Kabel, Stücklisten, Schaltschrankunterlagen, Reviews, Retrofit, Fehlersuche und IBN-nahe Themen. "
            "Dazu kommt praktische Erfahrung aus Schaltschrankbau, Montage, Inbetriebnahme, Lieferanten-/Projektabstimmung und Maschinenbau. "
            "Wenn es verbindlich um Termin, Preis, CE/Safety oder konkrete Projektfreigaben geht, leite ich den Verlauf nach Ihrer Zustimmung an Patrick weiter."
        )
    elif any(term in normalized for term in ["review", "prüfung", "pruefung", "prüfen", "pruefen", "qualität", "qualitaet", "check", "kontrolle"]):
        reply = (
            f"{prefix}bei einem EPLAN-Review kann Patrick zum Beispiel Struktur, BMK-Logik, Klemmen/Kabel, Stücklisten, Artikelstammdaten, Auswertungen, Fertigungsunterlagen und offensichtliche Übergabe-Risiken prüfen. "
            "Hilfreich wären EPLAN-Version, Projektstand, Ziel des Reviews und ob es um Fertigung, Inbetriebnahme, CE/Safety-Vorbereitung oder eine allgemeine Qualitätsprüfung geht."
        )
    elif any(term in normalized for term in ["ce", "safety", "norm", "risiko", "risikobeurteilung", "ul", "emv"]):
        reply = (
            f"{prefix}CE/Safety kann ich nur vorqualifizieren: Welche Normen, Risikobeurteilung, Performance-Level/Safety-Funktionen und vorhandenen Unterlagen es gibt. "
            "Eine verbindliche CE-/Normfreigabe macht Patrick erst nach persönlicher Prüfung der Dokumentation."
        )
    elif any(term in normalized for term in ["kost", "preis", "budget", "stundensatz", "angebot"]):
        reply = (
            f"{prefix}einen belastbaren Preis kann ich im Chat nicht nennen. Für eine grobe Einordnung braucht Patrick Umfang, EPLAN-Version, Unterlagenstand, gewünschte Lieferung, Zeitraum und ob Review oder aktive Konstruktion gefragt ist. "
            "Wenn Sie möchten, gebe ich den Verlauf mit Ihrer Zustimmung direkt an Patrick weiter."
        )
    elif any(term in normalized for term in ["wann", "start", "verfügbar", "verfuegbar", "kapazität", "kapazitaet", "kurzfristig", "längerfristig", "laengerfristig"]):
        reply = (
            f"{prefix}Start und Kapazität muss Patrick persönlich bestätigen. Für die Einschätzung sind Startwunsch, Laufzeit, Wochenstunden, Remote/Vor-Ort und EPLAN-Aufgaben wichtig. "
            "Ich kann diese Punkte sammeln und den Chatverlauf direkt an Patrick weitergeben."
        )
    elif any(term in normalized for term in ["eplan", "makro", "pro panel", "artikel", "bmk", "klemmen", "stückliste", "stueckliste"]):
        reply = (
            f"{prefix}bei EPLAN kann Patrick vor allem bei P8-Struktur, Makros, Artikel-/BMK-Logik, Klemmen, Kabeln, Stücklisten, Pro Panel/Smartwiring und Reviews unterstützen. "
            "Interessant wäre: Geht es um laufende Konstruktion als Ausfallvertretung, Review eines bestehenden Projekts oder Aufbau/Ordnung von Stammdaten?"
        )
    elif any(term in normalized for term in ["wirklich", "sicher", "ernsthaft"]):
        reply = (
            f"{prefix}ja, aber mit klarer Grenze: Ich kann vorqualifizieren und Patricks Arbeitsfelder erklären. "
            "Verbindliche Zusagen zu Verfügbarkeit, Aufwand, Preis oder Normen gibt Patrick persönlich nach Prüfung."
        )
    else:
        reply = (
            f"{prefix}ich kann das einordnen. Schreiben Sie kurz, ob es um EPLAN-Konstruktion, Review, Makros/Stammdaten, Schaltschrankunterlagen, CE/Safety oder kurzfristige Kapazität geht. "
            "Wenn Patrick übernehmen soll, kann ich den Verlauf nach Ihrer Zustimmung weiterleiten."
        )

    diagnostic = cast(dict[str, Any], (remote_fallback or {}).get("diagnostic") if isinstance((remote_fallback or {}).get("diagnostic"), dict) else {})
    return {
        "reply": reply,
        "mode": "local_bridge_fallback",
        "fallback_reason": (remote_fallback or {}).get("fallback_reason", "remote_fallback_replaced"),
        "requires_human": True,
        "escalation_reason": "review_required_personal_patrick",
        "diagnostic": diagnostic,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.address_string()} {format % args}", flush=True)

    def _headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        origin = self.headers.get("Origin") or "http://127.0.0.1:8088"
        if origin not in {"http://127.0.0.1:8088", "http://localhost:8088", "http://127.0.0.1:8788"}:
            origin = "http://127.0.0.1:8088"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _html_headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._headers(204)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._headers(200)
            self.wfile.write(json.dumps({"ok": True, "service": "dietz-local-assistant-bridge"}).encode())
            return
        if parsed.path == "/assistant/replies":
            params = parse_qs(parsed.query)
            session_id = _clean((params.get("session_id") or [""])[0], 120)
            after = int((params.get("after") or ["0"])[0] or 0)
            sessions = _load_sessions()
            session = sessions.get(session_id) if session_id else None
            replies = session.get("operator_replies", []) if isinstance(session, dict) else []
            self._headers(200)
            self.wfile.write(json.dumps({"ok": True, "session_id": session_id, "replies": replies[after:], "next": len(replies), "status": session.get("status", "missing") if isinstance(session, dict) else "missing"}, ensure_ascii=False).encode())
            return
        if parsed.path == "/operator/ui":
            params = parse_qs(parsed.query)
            session_id = _clean((params.get("session_id") or [""])[0], 120)
            sessions = _load_sessions()
            session = sessions.get(session_id) if session_id else None
            payload = session.get("last_customer_payload", {}) if isinstance(session, dict) else {}
            context = cast(dict[str, Any], payload.get("context") if isinstance(payload, dict) and isinstance(payload.get("context"), dict) else {})
            last_messages = session.get("customer_messages", []) if isinstance(session, dict) else []
            last_customer = ""
            if isinstance(last_messages, list) and last_messages:
                last_customer = _clean(cast(dict[str, Any], last_messages[-1]).get("message"), 1200)
            if not last_customer and isinstance(payload, dict):
                last_customer = _clean(payload.get("message") or payload.get("question"), 1200)
            customer_language = detect_message_language(last_customer)
            translated_for_patrick, translation_status = translate_for_patrick(last_customer, customer_language)
            details = []
            for label, key in [("Name", "contact_name"), ("Kontakt", "contact_contact"), ("Maschine/Anlage", "machine"), ("Bedarf", "scope"), ("Zeitrahmen", "timeline")]:
                value = _clean(context.get(key), 900)
                if value:
                    details.append(f"<div><strong>{html.escape(label)}:</strong> {html.escape(value)}</div>")
            body = f"""
              <h1>DIETZ Chat beantworten</h1>
              <p class="meta">Session: <code>{html.escape(session_id or 'fehlt')}</code></p>
              <div class="bubble"><strong>Kunde:</strong><br>{html.escape(last_customer or 'Noch keine Kundennachricht gefunden.')}</div>
              <p class="meta">Sprache erkannt: <strong>{html.escape(LANGUAGE_LABELS.get(customer_language, customer_language))}</strong></p>
              <div class="bubble"><strong>Übersetzung für Herrn Dietz:</strong><br>{html.escape(translated_for_patrick or last_customer or 'Keine Übersetzung erforderlich.')}</div>
              <p class="hint">Übersetzungsstatus: {html.escape(translation_status)}</p>
              <div class="hint">{''.join(details) or 'Kein weiterer Kontext gespeichert.'}</div>
              <form method="post" action="/operator/prepare-reply">
                <input type="hidden" name="session_id" value="{html.escape(session_id)}">
                <label for="target_language">Antwortsprache</label>
                <select id="target_language" name="target_language">
                  <option value="de" {'selected' if customer_language in {'de', 'unknown'} else ''}>Deutsch</option>
                  <option value="es" {'selected' if customer_language == 'es' else ''}>Spanisch</option>
                  <option value="zh" {'selected' if customer_language == 'zh' else ''}>Chinesisch</option>
                  <option value="en" {'selected' if customer_language == 'en' else ''}>Englisch</option>
                </select>
                <label for="message">Deine Antwort auf Deutsch</label>
                <textarea id="message" name="message" autofocus required placeholder="Antwort an den Kunden schreiben …"></textarea>
                <div class="actions">
                  <button type="submit" name="action" value="operator_reply">Entwurf prüfen</button>
                  <button class="secondary" type="submit" name="action" value="end_chat">Entwurf prüfen und Chat beenden</button>
                </div>
              </form>
            """
            self._html_headers(200)
            self.wfile.write(_html_page("DIETZ Chat beantworten", body))
            return
        self._headers(404)
        self.wfile.write(json.dumps({"ok": False, "error": "not_found"}).encode())

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path not in {"/assistant/lead", "/assistant", "/operator/reply", "/operator/customer-message", "/operator/ui/reply", "/operator/prepare-reply"}:
            self._headers(404)
            self.wfile.write(json.dumps({"ok": False, "error": "not_found"}).encode())
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("invalid_body_size")
            raw_body = self.rfile.read(length).decode("utf-8", errors="replace")
            if parsed.path == "/operator/prepare-reply":
                form = parse_qs(raw_body)
                session_id = _clean((form.get("session_id") or [""])[0], 120)
                draft = _clean((form.get("message") or [""])[0], 1200)
                action = _clean((form.get("action") or ["operator_reply"])[0], 80) or "operator_reply"
                target_language = _clean((form.get("target_language") or ["de"])[0], 20) or "de"
                prepared = prepare_operator_reply(draft, target_language)
                notes = prepared.get("correction_notes") or []
                note_html = "".join(f"<li>{html.escape(str(note))}</li>" for note in notes) or "<li>Keine einfachen lokalen Korrekturen gefunden.</li>"
                warning = ""
                if prepared.get("translation_status") == "review_required_translation_engine_missing":
                    warning = "<div class='bubble'><strong>Achtung:</strong> Lokale Übersetzungsengine fehlt noch. Bitte finale Kundensprache manuell prüfen oder AI/Argos/LanguageTool aktivieren.</div>"
                body = f"""
                  <h1>Entwurf prüfen</h1>
                  <p class="meta">Session: <code>{html.escape(session_id)}</code> · Antwortsprache: {html.escape(LANGUAGE_LABELS.get(target_language, target_language))}</p>
                  <div class="bubble"><strong>Korrigierte Fassung:</strong><br>{html.escape(str(prepared.get('corrected_message') or ''))}</div>
                  <div class="bubble"><strong>Zu senden / Übersetzung:</strong><br>{html.escape(str(prepared.get('translated_message') or ''))}</div>
                  {warning}
                  <div class="hint"><strong>Lokale Korrekturen:</strong><ul>{note_html}</ul></div>
                  <form method="post" action="/operator/ui/reply">
                    <input type="hidden" name="session_id" value="{html.escape(session_id)}">
                    <input type="hidden" name="action" value="{html.escape(action)}">
                    <label for="message">Finale Nachricht</label>
                    <textarea id="message" name="message" autofocus required>{html.escape(str(prepared.get('translated_message') or prepared.get('corrected_message') or draft))}</textarea>
                    <div class="actions">
                      <button type="submit">Geprüfte Antwort senden</button>
                      <a class="button" href="/operator/ui?session_id={quote(session_id)}">Zurück</a>
                    </div>
                  </form>
                """
                self._html_headers(200)
                self.wfile.write(_html_page("Entwurf prüfen", body))
                return

            if parsed.path == "/operator/ui/reply":
                form = parse_qs(raw_body)
                session_id = _clean((form.get("session_id") or [""])[0], 120)
                message = _clean((form.get("message") or [""])[0], 1200)
                action = _clean((form.get("action") or ["operator_reply"])[0], 80) or "operator_reply"
                if not session_id or not message:
                    raise ValueError("session_id_and_message_required")
                sessions = _load_sessions()
                session = sessions.setdefault(session_id, {"created_at": datetime.now(timezone.utc).isoformat(), "operator_replies": []})
                reply = {"from": "patrick", "message": message, "action": action, "at": datetime.now(timezone.utc).isoformat()}
                session.setdefault("operator_replies", []).append(reply)
                session["status"] = "closed" if action == "end_chat" else "operator_active"
                session["updated_at"] = datetime.now(timezone.utc).isoformat()
                _save_sessions(sessions)
                body = f"""
                  <h1>Antwort gesendet</h1>
                  <p class="meta">Session: <code>{html.escape(session_id)}</code></p>
                  <div class="bubble">{html.escape(message)}</div>
                  <div class="actions"><a class="button" href="/operator/ui?session_id={quote(session_id)}">Weiter antworten</a></div>
                """
                self._html_headers(200)
                self.wfile.write(_html_page("Antwort gesendet", body))
                return
            payload = json.loads(raw_body)
            sessions = _load_sessions()

            if parsed.path == "/assistant":
                status, data = _proxy_remote_assistant(raw_body)
                self._headers(status)
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
                return

            if parsed.path == "/operator/reply":
                session_id = _clean(payload.get("session_id"), 120)
                message = _clean(payload.get("message"), 1200)
                action = _clean(payload.get("action"), 80) or "operator_reply"
                if not session_id or not message:
                    raise ValueError("session_id_and_message_required")
                session = sessions.setdefault(session_id, {"created_at": datetime.now(timezone.utc).isoformat(), "operator_replies": []})
                reply = {"from": "patrick", "message": message, "action": action, "at": datetime.now(timezone.utc).isoformat()}
                session.setdefault("operator_replies", []).append(reply)
                session["status"] = "closed" if action == "end_chat" else "operator_active"
                _save_sessions(sessions)
                self._headers(200)
                self.wfile.write(json.dumps({"ok": True, "session_id": session_id, "reply": reply}, ensure_ascii=False).encode())
                return

            if parsed.path == "/operator/customer-message":
                session_id = _clean(payload.get("session_id"), 120)
                message = _clean(payload.get("message"), 1200)
                if not session_id or not message:
                    raise ValueError("session_id_and_message_required")
                session = sessions.setdefault(session_id, {"created_at": datetime.now(timezone.utc).isoformat(), "operator_replies": []})
                session.setdefault("customer_messages", []).append({"from": "customer", "message": message, "at": datetime.now(timezone.utc).isoformat()})
                session["last_customer_payload"] = payload
                session["status"] = "operator_active"
                session["updated_at"] = datetime.now(timezone.utc).isoformat()
                _save_sessions(sessions)
                result = _send_to_telegram(_format_customer_followup(payload, session_id))
                status = 200 if result.get("ok") else 502
                self._headers(status)
                self.wfile.write(json.dumps({"ok": bool(result.get("ok")), "delivered": bool(result.get("ok")), "session_id": session_id, "result": result}, ensure_ascii=False).encode())
                return

            session_id = _clean(payload.get("session_id"), 120) or _new_session_id()
            session = sessions.setdefault(session_id, {"created_at": datetime.now(timezone.utc).isoformat(), "operator_replies": []})
            session["last_customer_payload"] = payload
            session["status"] = "waiting_for_operator"
            session["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save_sessions(sessions)

            message = _format_message(payload, session_id=session_id)
            result = _send_to_telegram(message)
            status = 200 if result.get("ok") else 502
            self._headers(status)
            self.wfile.write(json.dumps({"ok": bool(result.get("ok")), "delivered": bool(result.get("ok")), "target": TARGET, "session_id": session_id, "reply_poll_url": f"/assistant/replies?session_id={session_id}", "reply_url": _reply_url(session_id), "result": result}, ensure_ascii=False).encode())
        except Exception as exc:
            self._headers(500)
            self.wfile.write(json.dumps({"ok": False, "error": str(exc)[:300]}).encode())


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"DIETZ local assistant bridge listening on http://{HOST}:{PORT} -> {TARGET}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
