/**
 * Anbieter-Registry: alle einstellbaren Dienste der Plattform mit Feldern und Anleitungen.
 * Wird von Server (erlaubte Schlüssel, Geheimnisse) und Oberfläche (Formulare, Info-Symbole) genutzt –
 * daher keine Server-Importe in dieser Datei.
 */
export type FieldType = "text" | "secret" | "url" | "number" | "select" | "generate";

export type ProviderField = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Kurzer Hinweis unter dem Feld */
  hint?: string;
  /** Anleitung im Info-Symbol */
  help?: string[];
  required?: boolean;
};

export type Category = "voice" | "telephony" | "calendar" | "email" | "maps" | "general";

/** full = vollständig integriert (Anrufannahme, Funktionen, Gesprächsende, Löschung);
 *  sip = Anbindung über SIP-Weiterleitung + generische Tool-Schnittstelle; info = nur Anleitung */
export type IntegrationLevel = "full" | "sip" | "info";

export type Provider = {
  id: string;
  category: Category;
  name: string;
  tagline: string;
  level: IntegrationLevel;
  website?: string;
  docs?: string;
  fields: ProviderField[];
  /** Schritt-für-Schritt-Anleitung (Info-Symbol am Anbieter) */
  setup: string[];
  /** Webhook-URLs, die beim Anbieter einzutragen sind (Schlüssel aus /api/admin/overview) */
  webhooks?: string[];
  /** Verbindung lässt sich per Knopf prüfen */
  testable?: boolean;
};

export const CATEGORY_LABEL: Record<Category, { title: string; description: string }> = {
  general: { title: "Allgemein & Sicherheit", description: "Plattformname, Standard-Sprach-KI, gemeinsames Webhook-Geheimnis, Rechtstexte." },
  voice: { title: "Sprach-KI", description: "Der Anbieter, der am Telefon spricht. Je Kunde und je Nummer frei wählbar – hier hinterlegst du die Zugänge." },
  telephony: { title: "Telefonie & VoIP", description: "Rufnummern, Weiterleitung, SMS. Kunden behalten ihre Nummer und leiten auf die Plattform um." },
  calendar: { title: "Kalender", description: "Outlook (Microsoft 365) und Google Kalender. Kunden verbinden ihren Kalender selbst im Portal – hier richtest du die App einmal ein." },
  email: { title: "E-Mail-Versand", description: "Bestätigungen, Technikerinfos, Einladungen und Passwort-Links." },
  maps: { title: "Karten & Fahrzeiten", description: "Für die Zusatzoption Einsatzplanung: Adressen in Koordinaten umwandeln und Fahrzeiten berechnen. Ohne Anbieter schätzt die Plattform aus der Luftlinie." },
};

export const LEVEL_LABEL: Record<IntegrationLevel, string> = {
  full: "voll integriert",
  sip: "über SIP + Tool-API",
  info: "Anleitung",
};

const zeroRetentionField = (id: string, name: string): ProviderField => ({
  key: `${id.toUpperCase()}_ZERO_RETENTION`,
  label: "Keine Speicherung beim Anbieter bestätigt",
  type: "select",
  options: [{ value: "false", label: "Nein – Anbieter speichert Gespräche (Hinweis wird immer angesagt)" }, { value: "true", label: "Ja – Zero Retention ist aktiv" }],
  hint: "Nur „Ja“, wenn beim Anbieter nachweislich nichts gespeichert wird. Sonst sagt die KI immer den Aufzeichnungshinweis an.",
  help: [`Bei ${name} die Option „Zero Data Retention“ bzw. „keine Speicherung“ für Agent/Organisation aktivieren.`, "Dann hier „Ja“ wählen. Kunden mit ausgeschalteter Aufzeichnung bekommen dann keinen Aufzeichnungshinweis."],
});

const sipProvider = (id: string, name: string, tagline: string, website: string, docs: string, extra: string[]): Provider => ({
  id,
  category: "voice",
  name,
  tagline,
  level: "sip",
  website,
  docs,
  fields: [
    {
      key: `SIP_${id.toUpperCase()}_URI`,
      label: "SIP-Adresse des Agenten",
      type: "text",
      placeholder: "sip:agent@sip.anbieter.com",
      required: true,
      hint: "Hierhin leitet Twilio den Anruf weiter.",
      help: [
        `Im Dashboard von ${name} einen Agenten für eingehende Anrufe anlegen.`,
        "Als Telefonie „SIP“ bzw. „eigene Telefonie / SIP-Trunk“ wählen und die angezeigte SIP-Adresse (beginnt mit sip:) hier eintragen.",
        "Die Plattform hängt Kopfzeilen an (X-Tenant, X-Caller, X-Called), damit der Agent weiß, für welchen Kunden er spricht.",
      ],
    },
    { key: `SIP_${id.toUpperCase()}_API_KEY`, label: "API-Schlüssel (optional)", type: "secret", hint: "Für spätere Funktionen (Gesprächsliste, Löschung) – wird verschlüsselt gespeichert." },
    zeroRetentionField(id, name),
  ],
  setup: [
    "NICHT FREIGEGEBEN: Für SIP-Anbieter sind Ereignis- und Tool-Format noch nicht mit echten Anrufen geprüft, und die Plattform löscht Aufnahmen und Transkripte dort nicht automatisch. Nur nach eigenem Test (docs/testanrufe.md) und mit AVV einsetzen; Löschung beim Anbieter selbst einrichten.",
    `Konto bei ${name} anlegen und einen Agenten mit deutschem Sprachmodell und Stimme erstellen.`,
    "Als Systemprompt den Text aus voice-agent/system-prompt.md verwenden (Variablen wie {{company_name}} ggf. durch die Werte des Kunden ersetzen oder per SIP-Kopfzeile übernehmen).",
    "Funktionen (Tools) als HTTP-Aufrufe anlegen: URL = „Generische Tool-URL“ unten, Methode POST, Kopfzeile „x-tool-secret“ = „Webhook-Geheimnis SIP-Anbieter“ aus „Allgemein“. Jeder Aufruf muss die Anruf-Referenz aus der SIP-Kopfzeile X-Call-Ref als Feld call_ref mitschicken – ohne sie wird der Aufruf keinem Anruf zugeordnet.",
    "Eingehende Telefonie auf SIP stellen und die SIP-Adresse oben eintragen.",
    "Im Kunden (Verwaltung → Kunde) diesen Anbieter auswählen.",
    ...extra,
  ],
  webhooks: ["genericTools"],
});

export const PROVIDERS: Provider[] = [
  // ───────────── Allgemein
  {
    id: "general",
    category: "general",
    name: "Plattform",
    tagline: "Grundeinstellungen für alle Kunden",
    level: "info",
    fields: [
      { key: "PLATFORM_NAME", label: "Plattformname", type: "text", placeholder: "KI-Telefonzentrale", hint: "Erscheint in E-Mails und Einladungen." },
      { key: "INVOICE_ISSUER_NAME", label: "Rechnungen: Firmenname", type: "text", placeholder: "Muster Telefonie GmbH", hint: "Ohne Name, Anschrift und Steuernummer werden keine Rechnungen ausgestellt." },
      { key: "INVOICE_ISSUER_ADDRESS", label: "Rechnungen: Anschrift", type: "text", placeholder: "Musterstr. 1, 10115 Berlin" },
      { key: "INVOICE_TAX_ID", label: "Rechnungen: USt-IdNr. oder Steuernummer", type: "text", placeholder: "DE123456789" },
      { key: "INVOICE_IBAN", label: "Rechnungen: Bankverbindung (IBAN)", type: "text", placeholder: "DE.. .... .... .... .... .." },
      { key: "INVOICE_EMAIL", label: "Rechnungen: Kontakt-E-Mail", type: "text", placeholder: "rechnung@ihre-firma.de" },
      { key: "INVOICE_PAYMENT_DAYS", label: "Rechnungen: Zahlungsziel (Tage)", type: "number", placeholder: "14" },
      { key: "STATUS_NOTICE", label: "Hinweis auf der Statusseite", type: "text", placeholder: "z. B. Wartung am 3.11. von 22–23 Uhr", hint: "Erscheint öffentlich unter /status. Leer = kein Hinweis." },
      {
        key: "VOICE_PROVIDER",
        label: "Standard-Sprach-KI",
        type: "select",
        options: [], // wird aus PROVIDERS (Kategorie voice) befüllt
        hint: "Gilt für alle Kunden ohne eigene Auswahl.",
        help: ["Jeder Kunde kann in der Verwaltung einen anderen Anbieter bekommen, jede Rufnummer zusätzlich einen eigenen.", "Reihenfolge: Nummer → Kunde → dieser Standard."],
      },
      {
        key: "VOICE_TOOL_SECRET",
        label: "Gemeinsames Webhook-Geheimnis (Übergang)",
        type: "generate",
        hint: "Alt: ein Geheimnis für alle Anbieter. Gilt nur, solange kein Anbieter-Geheimnis gesetzt ist.",
        help: ["Neu einrichten: stattdessen je Sprach-KI-Anbieter ein eigenes Geheimnis erzeugen (Retell, Vapi, ElevenLabs) und für SIP-Anbieter das Feld unten.", "Sobald eines davon gesetzt ist, nimmt die Plattform dieses gemeinsame Geheimnis nicht mehr an."],
      },
      {
        key: "VOICE_TOOL_SECRET_SIP",
        label: "Webhook-Geheimnis SIP-Anbieter",
        type: "generate",
        hint: "Eigenes Webhook-Geheimnis für alle SIP-Anbieter (Bland, Synthflow, LiveKit …). Ein Leck bei einem anderen Anbieter öffnet diese Schnittstelle nicht.",
        help: ["Auf „Erzeugen“ klicken – es wird ein zufälliger Wert gesetzt.", "Diesen Wert beim Anbieter eintragen (siehe Einrichtung unten).", "Sobald ein Anbieter-Geheimnis gesetzt ist, gilt das alte gemeinsame Webhook-Geheimnis nicht mehr – dann alle genutzten Anbieter umstellen."],
      },
      { key: "LEGAL_IMPRINT_URL", label: "Impressum (URL)", type: "url", placeholder: "https://…/impressum", help: ["Vorlage: docs/recht/impressum-vorlage.md.", "Erscheint unten im Portal und auf der Anmeldeseite."] },
      { key: "LEGAL_PRIVACY_URL", label: "Datenschutzerklärung (URL)", type: "url", placeholder: "https://…/datenschutz", help: ["Vorlage: docs/recht/datenschutzerklaerung-plattform.md."] },
    ],
    setup: ["Je Sprach-KI-Anbieter ein eigenes Webhook-Geheimnis erzeugen (bei Retell, Vapi, ElevenLabs bzw. hier für SIP-Anbieter) – ohne Geheimnis nehmen die Schnittstellen in Produktion keine Anfragen an.", "Standard-Sprach-KI wählen, nachdem du deren Zugang unter „Sprach-KI“ eingetragen hast."],
  },

  {
    id: "monitoring",
    category: "general",
    name: "Überwachung & Alarme",
    tagline: "Meldet gescheiterte Notfall-Alarme, hängende Anrufe, fehlende Backups und vollen Speicher.",
    level: "info",
    fields: [
      { key: "ALERT_EMAIL", label: "Alarm-E-Mail", type: "text", placeholder: "betrieb@deine-domain.de", hint: "Mehrere Adressen mit Komma trennen. Leer = alle Plattform-Admins.", help: ["Hierhin gehen alle Alarme der Überwachung (alle 5 Minuten).", "Läuft der E-Mail-Versand selbst nicht, kommt die E-Mail nicht an – deshalb zusätzlich einen Webhook oder eine SMS-Nummer eintragen."] },
      { key: "ALERT_SMS", label: "Alarm-SMS (nur kritisch)", type: "text", placeholder: "+49…", hint: "Bekommt nur kritische Alarme, z. B. nicht zugestellte Notfall-Alarme oder fehlende Backups." },
      { key: "ALERT_WEBHOOK_URL", label: "Alarm-Webhook (optional)", type: "secret", placeholder: "https://…", help: ["Unabhängig von E-Mail und SMS: z. B. Slack-, Teams- oder ntfy-Webhook.", "Die Plattform sendet JSON { text, level, id } per POST."] },
      { key: "HEALTHCHECK_PING_URL", label: "Lebenszeichen-URL (empfohlen)", type: "secret", placeholder: "https://hc-ping.com/…", help: ["Bei einem externen Dienst wie healthchecks.io einen Check mit 5 Minuten Intervall anlegen und dessen Ping-URL hier eintragen.", "Die Überwachung pingt alle 5 Minuten. Bleibt der Ping aus – etwa weil der ganze Server ausgefallen ist –, alarmiert der externe Dienst.", "Bei kritischen Befunden wird „/fail“ gemeldet."] },
    ],
    setup: [
      "Alarm-E-Mail und – für kritische Fälle – eine Alarm-SMS-Nummer eintragen.",
      "Externen Lebenszeichen-Dienst einrichten (z. B. healthchecks.io, kostenlos) und dessen Ping-URL eintragen. Nur so fällt auch ein kompletter Serverausfall auf.",
      "Zusätzlich einen Uptime-Check auf https://DOMAIN/api/health anlegen (z. B. UptimeRobot oder Better Stack), Intervall 1–5 Minuten.",
    ],
  },

  {
    id: "costguard",
    category: "general",
    name: "Kostenschutz",
    tagline: "Notschalter, gleichzeitige Anrufe, Gesprächsdauer und Tagesbudget – gegen Missbrauch und Kostenexplosion.",
    level: "info",
    fields: [
      { key: "AI_KILL_SWITCH", label: "Notschalter Sprach-KI", type: "select", options: [{ value: "off", label: "Aus – KI nimmt Anrufe an" }, { value: "on", label: "An – alle Anrufe an Fallback-Nummer bzw. Mailbox" }], help: ["Bei Missbrauch, Anbieterstörung oder Kostenproblemen: sofort alle Anrufe an Menschen leiten.", "Wirkt beim nächsten Anruf, laufende Gespräche bleiben."] },
      { key: "MAX_CALL_MINUTES", label: "Maximale Gesprächsdauer (Minuten)", type: "number", placeholder: "20", hint: "2–120, Standard 20. Danach legt Twilio auf." },
      { key: "MAX_CONCURRENT_CALLS_PER_TENANT", label: "Gleichzeitige Anrufe je Kunde", type: "number", placeholder: "5", hint: "Weitere Anrufer gehen an die Fallback-Nummer. 0 = unbegrenzt." },
      { key: "MAX_CONCURRENT_CALLS_TOTAL", label: "Gleichzeitige Anrufe gesamt", type: "number", placeholder: "50", hint: "Am Limit der Anbieter-Tarife ausrichten (Retell, Vapi, ElevenLabs). 0 = unbegrenzt." },
      { key: "SMS_ALLOWED_PREFIXES", label: "SMS nur in diese Länder", type: "text", placeholder: "+49,+43,+41", hint: "Kommagetrennte Vorwahlen, Standard Deutschland, Österreich, Schweiz. Schützt vor teuren SMS ins Ausland (SMS-Pumping)." },
      { key: "PLATFORM_DAILY_MINUTE_LIMIT", label: "Tagesbudget aller Kunden (Minuten)", type: "number", placeholder: "z. B. 3000", hint: "Leer = aus. Ab 80 % Warnung, ab 100 % gehen neue Anrufe an Fallback-Nummern." },
    ],
    setup: [
      "Gleichzeitige Anrufe gesamt auf das Limit des Sprach-KI-Tarifs setzen.",
      "Zusätzlich bei Twilio und den KI-Anbietern Budget-Grenzen bzw. Ausgabenalarme im jeweiligen Konto einrichten.",
    ],
  },

  // ───────────── Sprach-KI
  {
    id: "retell",
    category: "voice",
    name: "Retell AI",
    tagline: "Sehr natürliche Stimmen, gute deutsche Spracherkennung, einfache Agenten-Verwaltung.",
    level: "full",
    website: "https://www.retellai.com",
    docs: "https://docs.retellai.com",
    testable: true,
    fields: [
      { key: "RETELL_API_KEY", label: "API-Schlüssel", type: "secret", required: true, help: ["Retell-Dashboard → Settings → API Keys → „Create“.", "Der Schlüssel prüft auch die Signatur der Retell-Webhooks."] },
      { key: "RETELL_AGENT_ID", label: "Standard-Agent-ID", type: "text", placeholder: "agent_…", required: true, help: ["Retell-Dashboard → Agents → Agent öffnen → ID kopieren (beginnt mit agent_).", "Ein Agent bedient alle Kunden; Firmendaten kommen als Variablen pro Anruf."] },
      { key: "RETELL_AGENT_ID_NO_STORAGE", label: "Agent ohne Speicherung (optional)", type: "text", placeholder: "agent_…", hint: "Kopie des Agenten mit Datenspeicherung „Basic Attributes Only“ – für Kunden ohne Aufzeichnung.", help: ["Agenten duplizieren.", "In der Kopie unter Security & Privacy → Data Storage „Basic Attributes Only“ wählen.", "ID hier eintragen. Kunden mit ausgeschalteter Aufzeichnung nutzen dann automatisch diesen Agenten."] },
      { key: "RETELL_SIP_DOMAIN", label: "SIP-Domain", type: "text", placeholder: "sip.retellai.com", hint: "Nur ändern, wenn Retell es vorgibt." },
      {
        key: "VOICE_TOOL_SECRET_RETELL",
        label: "Webhook-Geheimnis Retell",
        type: "generate",
        hint: "Eigenes Webhook-Geheimnis für Retell. Ein Leck bei einem anderen Anbieter öffnet diese Schnittstelle nicht.",
        help: ["Auf „Erzeugen“ klicken – es wird ein zufälliger Wert gesetzt.", "Diesen Wert beim Anbieter eintragen (siehe Einrichtung unten).", "Sobald ein Anbieter-Geheimnis gesetzt ist, gilt das alte gemeinsame Webhook-Geheimnis nicht mehr – dann alle genutzten Anbieter umstellen."],
      },
    ],
    setup: [
      "Retell-Konto anlegen, Zahlungsmittel hinterlegen.",
      "Agent anlegen: Sprache Deutsch, Stimme wählen, LLM „Retell LLM“, Prompt aus voice-agent/system-prompt.md einfügen.",
      "Funktionen aus voice-agent/tools.json als „Custom Function“ anlegen: URL = Retell-Tool-URL unten mit Funktionsname statt {name}, Kopfzeile x-tool-secret = Webhook-Geheimnis Retell (oben).",
      "Agent → Webhook URL = Ereignis-URL unten.",
      "Telefonie: KEINE Nummer bei Retell kaufen – die Plattform verbindet Twilio-Anrufe selbst (Custom Telephony).",
      "API-Schlüssel und Agent-ID hier eintragen und „Verbindung testen“.",
    ],
    webhooks: ["retellTools", "retellEvents"],
  },
  {
    id: "vapi",
    category: "voice",
    name: "Vapi",
    tagline: "Entwicklerfreundlich, frei kombinierbare Sprachmodelle, Stimmen und Transkription.",
    level: "full",
    website: "https://vapi.ai",
    docs: "https://docs.vapi.ai",
    testable: true,
    fields: [
      { key: "VAPI_API_KEY", label: "Private API Key", type: "secret", required: true, help: ["Vapi-Dashboard → Organization → API Keys → „Private Key“ kopieren (nicht den Public Key)."] },
      { key: "VAPI_ASSISTANT_ID", label: "Standard-Assistent-ID", type: "text", placeholder: "UUID", required: true, help: ["Vapi-Dashboard → Assistants → Assistent öffnen → ID kopieren."] },
      { key: "VAPI_SIP_HOST", label: "SIP-Host", type: "text", placeholder: "sip.vapi.ai", hint: "EU-Region (nur Vapi Premier): sip.eu.vapi.ai" },
      zeroRetentionField("vapi", "Vapi"),
      {
        key: "VOICE_TOOL_SECRET_VAPI",
        label: "Webhook-Geheimnis Vapi",
        type: "generate",
        hint: "Eigenes Webhook-Geheimnis für Vapi. Ein Leck bei einem anderen Anbieter öffnet diese Schnittstelle nicht.",
        help: ["Auf „Erzeugen“ klicken – es wird ein zufälliger Wert gesetzt.", "Diesen Wert beim Anbieter eintragen (siehe Einrichtung unten).", "Sobald ein Anbieter-Geheimnis gesetzt ist, gilt das alte gemeinsame Webhook-Geheimnis nicht mehr – dann alle genutzten Anbieter umstellen."],
      },
    ],
    setup: [
      "Vapi-Konto anlegen.",
      "Assistent anlegen: Transcriber Deutsch (z. B. Deepgram nova-3 „de“), Modell und Stimme frei wählen, Prompt aus voice-agent/system-prompt.md.",
      "Organisation → Settings → Server URL = Vapi-Server-URL unten. Unter „Credentials“ eine Bearer-Credential mit Header-Name x-vapi-secret und dem Webhook-Geheimnis Vapi (oben) anlegen und der Server-URL zuweisen.",
      "Funktionen aus voice-agent/tools.json als Tools vom Typ „function“ an den Assistenten hängen (ohne eigene URL – sie laufen über die Server-URL).",
      "Schlüssel und Assistent-ID hier eintragen und „Verbindung testen“.",
      "Telefonie: Die Plattform legt für jede Rufnummer mit Vapi automatisch eine Vapi-SIP-Nummer (sip:ck…@sip.vapi.ai) an und leitet Twilio-Anrufe dorthin. Firmendaten des Kunden schickt die Plattform bei jedem Anruf per „assistant-request“.",
      "Datenschutz: Vapi bietet „Zero Data Retention“ (Organisation → Compliance). Danach unten „Ja“ wählen.",
    ],
    webhooks: ["vapiServer"],
  },
  {
    id: "elevenlabs",
    category: "voice",
    name: "ElevenLabs Agents",
    tagline: "Führende Stimmqualität und Stimmenklone, Agenten-Plattform mit Wissensdatenbank.",
    level: "full",
    website: "https://elevenlabs.io/agents",
    docs: "https://elevenlabs.io/docs/agents-platform/overview",
    testable: true,
    fields: [
      { key: "ELEVENLABS_API_KEY", label: "API-Schlüssel", type: "secret", required: true, help: ["ElevenLabs → Developers → API Keys → neuen Schlüssel mit Rechten für „Agents“ (ElevenLabs Agents / Conversational AI) anlegen."] },
      { key: "ELEVENLABS_AGENT_ID", label: "Standard-Agent-ID", type: "text", placeholder: "agent_…", required: true, help: ["ElevenLabs → Agents → Agent öffnen → ID kopieren."] },
      zeroRetentionField("elevenlabs", "ElevenLabs"),
      { key: "ELEVENLABS_API_BASE", label: "API-Region (optional)", type: "select", options: [{ value: "https://api.elevenlabs.io", label: "Standard" }, { value: "https://api.eu.residency.elevenlabs.io", label: "EU-Datenresidenz (Vertrag nötig)" }, { value: "https://api.us.elevenlabs.io", label: "USA" }] },
      {
        key: "VOICE_TOOL_SECRET_ELEVENLABS",
        label: "Webhook-Geheimnis ElevenLabs (Tools)",
        type: "generate",
        hint: "Eigenes Webhook-Geheimnis für die ElevenLabs-Tools. Ein Leck bei einem anderen Anbieter öffnet diese Schnittstelle nicht.",
        help: ["Auf „Erzeugen“ klicken – es wird ein zufälliger Wert gesetzt.", "Diesen Wert beim Anbieter eintragen (siehe Einrichtung unten).", "Sobald ein Anbieter-Geheimnis gesetzt ist, gilt das alte gemeinsame Webhook-Geheimnis nicht mehr – dann alle genutzten Anbieter umstellen."],
      },
      { key: "ELEVENLABS_WEBHOOK_SECRET", label: "Webhook-Secret (Post-Call)", type: "secret", help: ["ElevenLabs → Agents → Settings → Post-call webhook anlegen: URL = ElevenLabs-Ereignis-URL unten.", "Das angezeigte HMAC-Secret hier eintragen – damit prüft die Plattform die Signatur."] },
    ],
    setup: [
      "ElevenLabs-Konto mit Agents-Zugang anlegen.",
      "Agent anlegen: Sprache Deutsch, Stimme wählen, Prompt aus voice-agent/system-prompt.md; Variablen {{…}} bleiben – die Plattform füllt sie pro Anruf.",
      "Agent-Audio auf μ-law 8000 Hz stellen (Eingang und Sprachausgabe) – Pflicht für Twilio.",
      "Funktionen aus voice-agent/tools.json als „Webhook“-Tools anlegen: Methode POST, URL = Generische Tool-URL mit Funktionsname, Kopfzeile x-tool-secret = Webhook-Geheimnis ElevenLabs (oben). Zusätzlich je Tool das Feld call_sid als Dynamic Variable system__call_sid anlegen (nicht von der KI befüllen lassen!) – nur darüber ordnet die Plattform den laufenden Anruf zu. called_number (system__called_number) und caller_id (system__caller_id) optional.",
      "Post-call webhook (Typ „transcript“) auf die ElevenLabs-Ereignis-URL setzen, Secret hier eintragen.",
      "Telefonie: Die Plattform verbindet Twilio-Anrufe per Register-Call-API – keine Nummer bei ElevenLabs nötig. Einschränkung: Weiterleiten an Menschen (Notfall-Durchstellung) ist auf diesem Weg nicht möglich; Notfälle werden per SMS/E-Mail alarmiert.",
    ],
    webhooks: ["genericTools", "elevenlabsEvents"],
  },
  sipProvider("bland", "Bland AI", "Hochskalierbare Telefon-Agenten, stark bei großen Anrufmengen und Kampagnen.", "https://www.bland.ai", "https://docs.bland.ai", []),
  sipProvider("synthflow", "Synthflow", "No-Code-Baukasten: Voice-Bots per Klick zusammenstellen.", "https://synthflow.ai", "https://docs.synthflow.ai", []),
  sipProvider("airai", "Air AI", "Sehr lange, menschlich wirkende Gespräche.", "https://www.air.ai", "https://www.air.ai", ["Air AI vergibt Zugänge teils nur auf Anfrage – SIP-Anbindung beim Vertrieb erfragen."]),
  sipProvider("polyai", "PolyAI", "Enterprise-Callcenter mit tiefen CRM-Integrationen.", "https://poly.ai", "https://poly.ai", ["PolyAI richtet Agenten im Projekt ein – SIP-Ziel und Tool-Anbindung mit dem PolyAI-Team abstimmen."]),
  sipProvider("livekit", "LiveKit Agents (selbst gehostet)", "Open-Source: eigene Sprach-Pipeline mit freier Wahl von STT, LLM und TTS.", "https://livekit.io", "https://docs.livekit.io/agents/", ["LiveKit SIP-Dienst einrichten (Inbound Trunk + Dispatch Rule) und dessen SIP-Adresse eintragen.", "Im Agenten die Kopfzeilen X-Tenant/X-Caller/X-Called aus den SIP-Attributen lesen."]),
  sipProvider("pipecat", "Pipecat (selbst gehostet)", "Open-Source-Framework für eigene Sprach-Pipelines (Python).", "https://www.pipecat.ai", "https://docs.pipecat.ai", ["Pipecat über einen SIP-fähigen Transport (z. B. Daily oder eigener SIP-Server) erreichbar machen und dessen SIP-Adresse eintragen."]),
  sipProvider("custom", "Eigener SIP-Agent", "Beliebiger anderer Anbieter oder eigene Lösung mit SIP-Zugang.", "", "", []),

  // ───────────── Telefonie
  {
    id: "twilio",
    category: "telephony",
    name: "Twilio",
    tagline: "Rufnummern in Deutschland, Weiterleitung an die Sprach-KI, SMS und Ausfall-Mailbox.",
    level: "full",
    website: "https://www.twilio.com",
    docs: "https://www.twilio.com/docs/voice",
    testable: true,
    fields: [
      { key: "TWILIO_ACCOUNT_SID", label: "Account SID", type: "text", placeholder: "AC…", required: true, help: ["Twilio-Konsole → Startseite → „Account Info“ → Account SID."] },
      { key: "TWILIO_AUTH_TOKEN", label: "Auth Token", type: "secret", required: true, help: ["Twilio-Konsole → Account Info → Auth Token anzeigen und kopieren.", "Damit prüft die Plattform auch die Signatur jedes Twilio-Aufrufs."] },
      { key: "TWILIO_SMS_FROM", label: "SMS-Absender (optional)", type: "text", placeholder: "+49… oder MG…", help: ["Eine SMS-fähige Twilio-Nummer oder die SID eines Messaging Service (beginnt mit MG).", "Deutsche Nummern sind oft nicht SMS-fähig – dann alphanumerischen Absender über einen Messaging Service nutzen."] },
    ],
    setup: [
      "Twilio-Konto anlegen und aufladen.",
      "Deutsche Ortsnummern kaufen (Phone Numbers → Buy). Für Deutschland ist ein „Regulatory Bundle“ mit Adressnachweis nötig.",
      "Je Nummer unter Voice Configuration: „A call comes in“ = Twilio-Voice-URL (POST), „Call status changes“ = Twilio-Status-URL (POST, für Gesprächsende und Abrechnung). „Primary handler fails“ = eine TwiML Bin bei Twilio (Inhalt: Verwaltung → Kunde → Rufnummer → „Ersatzziel bei Twilio“) – NICHT die eigene Fallback-URL, sonst fällt sie mit dem Server aus. Die Überwachung prüft das stündlich.",
      "Nummer in der Verwaltung dem Kunden zuordnen.",
      "Der Kunde leitet seine bisherige Nummer (Festnetz/VoIP) auf die Twilio-Nummer um – siehe „VoIP / Rufumleitung“.",
    ],
    webhooks: ["twilioVoice", "twilioStatus", "twilioFallback"],
  },
  {
    id: "voip",
    category: "telephony",
    name: "VoIP / Rufumleitung (sipgate, Telekom, easybell, Placetel …)",
    tagline: "Kunden behalten ihre Nummer und Telefonanlage – Anrufe werden umgeleitet.",
    level: "info",
    fields: [],
    setup: [
      "Variante A (empfohlen, keine Technik beim Kunden): Rufumleitung der bestehenden Nummer auf die zugeordnete Twilio-Nummer – sofort, bei besetzt, nach x Sekunden oder außerhalb der Öffnungszeiten.",
      "sipgate: Web-Oberfläche → Telefonie → Rufnummer → Weiterleitung. Telekom: *21*Zielnummer# (sofort), *61*Zielnummer# (nach Zeit), *67*Zielnummer# (besetzt).",
      "Fritz!Box/TK-Anlage: Telefonie → Rufbehandlung → Rufumleitung auf die Twilio-Nummer.",
      "Variante B (fortgeschritten): SIP-Trunk des Kunden direkt zur Sprach-KI (Retell/Vapi/ElevenLabs bieten SIP-Trunking). Dann läuft der Anruf nicht über Twilio; Kontingent und Fallback der Plattform greifen nicht.",
      "Kosten: Umleitungen kosten beim Anbieter des Kunden meist den Mobil-/Festnetztarif, Twilio berechnet eingehende Minuten.",
    ],
  },

  // ───────────── Kalender
  {
    id: "microsoft",
    category: "calendar",
    name: "Microsoft 365 / Outlook",
    tagline: "Eine App für alle Kunden – jeder Kunde erteilt seine Freigabe per Administratorzustimmung.",
    level: "full",
    website: "https://entra.microsoft.com",
    docs: "https://learn.microsoft.com/graph/auth-v2-service",
    fields: [
      { key: "MS_CLIENT_ID", label: "Anwendungs-ID (Client ID)", type: "text", placeholder: "UUID", required: true, help: ["entra.microsoft.com → App-Registrierungen → Neue Registrierung → „Konten in einem beliebigen Organisationsverzeichnis (mehrinstanzenfähig)“.", "Umleitungs-URI (Web) = Microsoft-Redirect-URL unten.", "Anwendungs-ID von der Übersichtsseite kopieren."] },
      { key: "MS_CLIENT_SECRET", label: "Geheimer Clientschlüssel", type: "secret", required: true, help: ["App → Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel → WERT kopieren (nicht die ID).", "Ablaufdatum notieren und rechtzeitig erneuern."] },
    ],
    setup: [
      "App registrieren (mehrinstanzenfähig), Umleitungs-URI eintragen.",
      "API-Berechtigungen → Microsoft Graph → Anwendungsberechtigungen: Calendars.ReadWrite, Mail.ReadWrite (für Entwürfe), User.Read.All.",
      "Client-ID und Geheimnis hier eintragen.",
      "Kunden klicken im Portal unter Einstellungen → Integrationen auf „Microsoft 365 verbinden“ und erteilen als Admin ihres Microsoft-Kontos die Zustimmung.",
    ],
    webhooks: ["microsoftRedirect"],
  },
  {
    id: "google",
    category: "calendar",
    name: "Google Kalender",
    tagline: "Google Workspace oder privates Google-Konto – Kunden verbinden sich per Google-Anmeldung.",
    level: "full",
    website: "https://console.cloud.google.com",
    docs: "https://developers.google.com/calendar/api/guides/overview",
    fields: [
      { key: "GOOGLE_CLIENT_ID", label: "OAuth-Client-ID", type: "text", placeholder: "….apps.googleusercontent.com", required: true, help: ["console.cloud.google.com → Projekt anlegen → APIs & Dienste → „Google Calendar API“ aktivieren.", "OAuth-Zustimmungsbildschirm: Typ „Extern“, Bereiche calendar.events und calendar.freebusy.", "Anmeldedaten → OAuth-Client-ID → Webanwendung → Autorisierte Weiterleitungs-URI = Google-Redirect-URL unten."] },
      { key: "GOOGLE_CLIENT_SECRET", label: "OAuth-Clientschlüssel", type: "secret", required: true, help: ["Beim Anlegen der OAuth-Client-ID angezeigt („Clientschlüssel“)."] },
    ],
    setup: [
      "Google-Cloud-Projekt anlegen, Calendar API aktivieren.",
      "OAuth-Zustimmungsbildschirm einrichten. Solange die App im Status „Test“ ist, nur eingetragene Testnutzer – für alle Kunden „Veröffentlichen“ und ggf. Google-Prüfung durchlaufen.",
      "OAuth-Client (Webanwendung) mit der Google-Redirect-URL anlegen, ID und Schlüssel hier eintragen.",
      "Kunden klicken im Portal auf „Google Kalender verbinden“. Termine landen im Kalender des Mitarbeiters (dessen E-Mail-Adresse) – bei Google Workspace muss der verbindende Nutzer Schreibrechte auf diese Kalender haben.",
    ],
    webhooks: ["googleRedirect"],
  },

  // ───────────── E-Mail
  {
    id: "smtp",
    category: "email",
    name: "SMTP (IONOS, Brevo, Postmark, Microsoft 365 …)",
    tagline: "Beliebiger Mailserver.",
    level: "full",
    testable: true,
    fields: [
      { key: "SMTP_HOST", label: "Server", type: "text", placeholder: "smtp.ionos.de", required: true, help: ["IONOS: smtp.ionos.de · Brevo: smtp-relay.brevo.com · Microsoft 365: smtp.office365.com."] },
      { key: "SMTP_PORT", label: "Port", type: "number", placeholder: "587", hint: "587 (STARTTLS) oder 465 (SSL)." },
      { key: "SMTP_USER", label: "Benutzer", type: "text", placeholder: "noreply@deine-domain.de" },
      { key: "SMTP_PASS", label: "Passwort", type: "secret" },
      { key: "SMTP_FROM", label: "Absender", type: "text", placeholder: "KI-Telefonzentrale <noreply@deine-domain.de>", required: true, help: ["Muss zur Domain des SMTP-Kontos passen.", "SPF, DKIM und DMARC der Domain einrichten, sonst landen Mails im Spam."] },
    ],
    setup: ["Postfach bzw. SMTP-Zugang beim Anbieter anlegen.", "Zugangsdaten eintragen und „Verbindung testen“ – die Plattform meldet sich am Server an, ohne eine Mail zu senden."],
  },

  // ───────────── Karten & Fahrzeiten
  {
    id: "maps",
    category: "maps",
    name: "OpenRouteService oder eigene OSM-Server",
    tagline: "Geokodierung und Fahrzeiten mit OpenStreetMap-Daten – EU-Anbieter oder selbst betrieben.",
    level: "full",
    website: "https://openrouteservice.org",
    docs: "https://openrouteservice.org/dev/#/api-docs",
    testable: true,
    fields: [
      { key: "MAPS_PROVIDER", label: "Anbieter", type: "select", options: [{ value: "", label: "Aus – Schätzung aus Luftlinie" }, { value: "ors", label: "OpenRouteService (HeiGIT, Heidelberg)" }, { value: "osm", label: "Eigener Nominatim- und OSRM-Server" }], help: ["OpenRouteService: gemeinnütziger Anbieter aus Heidelberg, Server in Deutschland, kostenloses Kontingent für den Start.", "Eigene Server: Nominatim (Adressen) und OSRM (Fahrzeiten) mit Deutschland-Karte auf einem eigenen VPS – keine Daten an Dritte.", "Den öffentlichen Nominatim-Server von OpenStreetMap bitte nicht verwenden (Nutzungsbedingungen)."] },
      { key: "ORS_API_KEY", label: "OpenRouteService API-Schlüssel", type: "secret", help: ["openrouteservice.org → Sign up → Dashboard → „Request a token“ (Standard).", "Kontingente laut Tarif beachten; Ergebnisse werden zwischengespeichert."] },
      { key: "NOMINATIM_URL", label: "Nominatim-URL (eigener Server)", type: "url", placeholder: "https://nominatim.deine-domain.de" },
      { key: "OSRM_URL", label: "OSRM-URL (eigener Server)", type: "url", placeholder: "https://osrm.deine-domain.de" },
    ],
    setup: [
      "Anbieter wählen und Zugang eintragen, dann „Verbindung testen“.",
      "Gespeichert werden nur Koordinaten (gerundet) zu einem Hash der Adresse, 180 Tage – keine Klartextadressen.",
      "Auftragsverarbeitung: OpenRouteService erhält Adressen von Endkunden – AV-Vertrag abschließen und in der Liste der Unterauftragsverarbeiter ergänzen.",
    ],
  },
];

for (const f of PROVIDERS.find((p) => p.id === "general")!.fields) {
  if (f.key === "VOICE_PROVIDER") f.options = PROVIDERS.filter((p) => p.category === "voice").map((p) => ({ value: p.level === "sip" ? `sip:${p.id}` : p.id, label: p.level === "sip" ? `${p.name} (nicht freigegeben)` : p.name }));
}

export const VOICE_PROVIDER_OPTIONS = PROVIDERS.filter((p) => p.category === "voice").map((p) => ({ value: p.level === "sip" ? `sip:${p.id}` : p.id, label: p.level === "sip" ? `${p.name} (nicht freigegeben)` : p.name, level: p.level }));

export const SETTING_KEYS = new Set(PROVIDERS.flatMap((p) => p.fields.map((f) => f.key)).concat(["COST_TELEPHONY_CENTS_PER_MIN", "COST_VOICE_CENTS_PER_MIN", "COST_SMS_CENTS", "VAT_PERCENT"]));
export const SECRET_KEYS = new Set(PROVIDERS.flatMap((p) => p.fields.filter((f) => f.type === "secret" || f.type === "generate").map((f) => f.key)));

/** Funktionen, die ein Paket enthalten kann (Anzeige + Prüfung) */
export const PLAN_FEATURES: { key: string; label: string; help: string }[] = [
  { key: "calendar_internal", label: "Interner Kalender & Terminbuchung", help: "Termine aus Anrufen, Bestätigung per E-Mail mit Kalendereintrag." },
  { key: "email_notifications", label: "E-Mail-Benachrichtigungen", help: "Kundenbestätigung, Technikerinfo, Büro-Kopie." },
  { key: "emergency_forwarding", label: "Notfall-Durchstellung", help: "Notfälle werden live an den Bereitschaftsdienst durchgestellt." },
  { key: "calendar_external", label: "Outlook- / Google-Kalender", help: "Belegung und Termine direkt im Kalender der Mitarbeiter." },
  { key: "sms", label: "SMS-Bestätigungen", help: "Bestätigung und Notfallalarm per SMS (Kontingent laut Paket)." },
  { key: "custom_greeting", label: "Eigene Begrüßung & FAQ", help: "Individueller Begrüßungstext und Wissensbasis." },
  { key: "recording", label: "Gesprächsaufzeichnung", help: "Audioaufnahme mit Hinweis (rechtliche Prüfung erforderlich)." },
  { key: "own_agent", label: "Eigener KI-Agent / Anbieterwahl", help: "Eigener Agent bzw. anderer Sprach-KI-Anbieter für diesen Kunden." },
  { key: "webhooks", label: "Webhooks für eigene Systeme", help: "Vorgänge und Anrufe automatisch an CRM, Zapier/Make oder Warenwirtschaft senden." },
  { key: "priority_support", label: "Bevorzugter Support", help: "Schnellere Reaktionszeiten." },
  // Zusatzoptionen: im Paket enthalten = ohne Aufpreis freigeschaltet (sonst einzeln buchbar, src/lib/addons.ts)
  { key: "invoicing", label: "Zusatzoption: Angebote & Rechnungen", help: "Im Paket enthalten statt einzeln buchbar." },
  { key: "field_app", label: "Zusatzoption: Techniker-App", help: "Im Paket enthalten statt einzeln buchbar." },
  { key: "customer_contact", label: "Zusatzoption: Kundenkontakt plus", help: "Im Paket enthalten statt einzeln buchbar." },
  { key: "planning", label: "Zusatzoption: Einsatzplanung", help: "Im Paket enthalten statt einzeln buchbar." },
  { key: "booking_page", label: "Zusatzoption: Online-Terminbuchung", help: "Im Paket enthalten statt einzeln buchbar." },
];
