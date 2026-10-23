import { URGENCY_RANK, type Urgency } from "./constants";
import { getTemplate, type UrgencyRules } from "./tenant/templates";

/**
 * Regelbasierte Dringlichkeitsbewertung als Sicherheitsnetz zur Einschätzung
 * der Sprach-KI: es gilt immer die HÖHERE Stufe. Regeln kommen aus
 * Branchenvorlage + Mandanten-Einstellungen.
 */
export function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Trifft Stichwort, aber nicht verneint ("kein Notfall", "keine Allergie").
 * Mehrwort-Stichwörter erlauben bis zu vier Füllwörter dazwischen –
 * "heizung aus" trifft auch "Heizung ist komplett aus".
 */
function keywordRegex(k: string): RegExp {
  const words = k.toLowerCase().trim().split(/\s+/).map(escape);
  return new RegExp(`(?<!kein\\s)(?<!keine\\s)(?<!nicht\\s)${words.join("(?:[^\\S\\n]+\\S+){0,4}?[^\\S\\n]+")}`, "i");
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((k) => keywordRegex(k).test(text));
}

export function assessUrgency(input: {
  category?: string | null;
  description?: string | null;
  customerType?: string | null;
  aiUrgency?: Urgency | null;
  rules?: UrgencyRules;
}): Urgency {
  const rules = input.rules ?? getTemplate("general").urgency;
  const text = `${input.category ?? ""} ${input.description ?? ""}`.toLowerCase();
  const cat = (input.category ?? "").toLowerCase();
  let level: Urgency = "MEDIUM";

  if (hasKeyword(text, rules.low)) level = "LOW";
  if (rules.highCategories.some((c) => c.toLowerCase() === cat)) level = maxUrgency(level, "HIGH");
  if (input.customerType === "BUSINESS" && rules.businessHighCategories.some((c) => c.toLowerCase() === cat)) level = maxUrgency(level, "HIGH");
  if (hasKeyword(text, rules.high)) level = maxUrgency(level, "HIGH");
  if (hasKeyword(text, rules.critical)) level = maxUrgency(level, "CRITICAL");

  return input.aiUrgency ? maxUrgency(level, input.aiUrgency) : level;
}
