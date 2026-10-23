import { URGENCY_RANK, type CustomerType, type Urgency } from "./constants";

/**
 * Regelbasierte Dringlichkeitsbewertung. Dient als Sicherheitsnetz zur
 * Einschätzung der Sprach-KI: es wird immer die HÖHERE Stufe verwendet.
 */
const CRITICAL_PATTERNS = [
  /allergi/i, /anaphyla/i, /gestochen/i, /atemnot/i, /(?<!kein\s)notfall/i,
  /baby|säugling|kleinkind/i, /kita|kindergarten|schule|krankenhaus|klinik|pflegeheim/i,
];
const HIGH_PATTERNS = [
  /restaurant|küche|gastro|lebensmittel|bäckerei|metzgerei|kantine|hotel|haccp/i,
  /behörde|gesundheitsamt|kontrolle|audit/i,
  /eingang|tür|balkon|kinderzimmer|schlafzimmer/i,
  /viele|massenhaft|überall|befall/i,
];
const LOW_PATTERNS = [/vorsorge|prävention|wartung|angebot|beratung|information/i];

export function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;
}

export function assessUrgency(input: {
  pestType?: string | null;
  description?: string | null;
  customerType?: CustomerType | string | null;
  aiUrgency?: Urgency | null;
}): Urgency {
  const text = `${input.pestType ?? ""} ${input.description ?? ""}`;
  let level: Urgency = "MEDIUM";

  if (LOW_PATTERNS.some((r) => r.test(text))) level = "LOW";

  const pest = (input.pestType ?? "").toLowerCase();
  if (pest.includes("ratte") || pest.includes("schabe") || pest.includes("bettwanze")) level = maxUrgency(level, "MEDIUM");
  if (pest.includes("wespe") || pest.includes("hornisse")) level = maxUrgency(level, "HIGH");

  if (HIGH_PATTERNS.some((r) => r.test(text))) level = maxUrgency(level, "HIGH");
  if (input.customerType === "B2B_HACCP" && (pest.includes("ratte") || pest.includes("maus") || pest.includes("mäuse") || pest.includes("schabe"))) {
    level = maxUrgency(level, "HIGH");
  }
  if (CRITICAL_PATTERNS.some((r) => r.test(text))) level = maxUrgency(level, "CRITICAL");

  return input.aiUrgency ? maxUrgency(level, input.aiUrgency) : level;
}
