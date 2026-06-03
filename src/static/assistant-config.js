window.DIETZ_ASSISTANT_CONFIG = {
  mode: "hybrid",
  endpoint: "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant",
  localDevEndpoint: "http://127.0.0.1:8790/assistant",
  localProxyEndpoint: "http://127.0.0.1:8790/assistant",
  remoteTestEndpoint: "https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant",
  liveAiEnabled: true,
  fallbackEnabled: true,
  avatar: "aria-assistant-avatar.jpg",
  handoffMode: "telegram_review",
  operatorChannel: "telegram_private_group",
  availabilityTimezone: "Europe/Berlin",
  availableFromHour: 8,
  availableUntilHour: 17,
  knowledgeVersion: "dietz-trust-v1",
  maxQuestionChars: 900,
  timeoutMs: 9000,
  consentText: "Ich bestätige, dass meine Angaben zur Bearbeitung der Anfrage verarbeitet und bei Bedarf an Patrick Dietz weitergeleitet werden dürfen. Bitte keine vertraulichen Projektdateien im Chat senden."
};
