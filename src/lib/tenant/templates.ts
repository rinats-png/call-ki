import type { CustomerType, EmployeeRole } from "../constants";
import { DEFAULT_CUSTOMER_TYPE_LABEL, DEFAULT_ROLE_LABEL } from "../constants";

/**
 * Branchenvorlagen: liefern Kategorien, Dringlichkeitsregeln, Rollenbezeichnungen
 * und Branchenwissen für den KI-Prompt. Neue Branche = neuer Eintrag hier.
 * Jeder Mandant kann Kategorien und Stichwörter in seinen Einstellungen überschreiben.
 */
export type UrgencyRules = {
  /** Stichwörter → Notfall (sofort durchstellen) */
  critical: string[];
  /** Stichwörter → hohe Dringlichkeit */
  high: string[];
  /** Stichwörter → niedrige Dringlichkeit (Beratung, Angebot) */
  low: string[];
  /** Kategorien, die grundsätzlich hoch sind */
  highCategories: string[];
  /** Kategorien, die bei Gewerbekunden hoch sind */
  businessHighCategories: string[];
};

export type IndustryTemplate = {
  key: string;
  label: string;
  description: string;
  categories: string[];
  roleLabels: Record<EmployeeRole, string>;
  customerTypeLabels: Record<CustomerType, string>;
  /** Kundentypen, die bevorzugt an SPECIALIST gehen */
  specialistCustomerTypes: CustomerType[];
  urgency: UrgencyRules;
  /** Branchenwissen & Gesprächsleitfaden für die KI */
  promptContext: string;
  intakeQuestions: string[];
  safetyRules: string[];
  defaultDurationMin: number;
  /** Bezeichnung eines Einsatzes in Texten ("Einsatz", "Termin", "Auftrag") */
  jobNoun: string;
};

const COMMON_CRITICAL = ["notfall", "lebensgefahr", "atemnot", "bewusstlos", "verletzt"];
const COMMON_LOW = ["angebot", "beratung", "information", "vorsorge", "wartung", "kostenvoranschlag"];

export const TEMPLATES: Record<string, IndustryTemplate> = {
  pest_control: {
    key: "pest_control",
    label: "Schädlingsbekämpfung",
    description: "Wespen, Ratten, Bettwanzen & Co. – inkl. HACCP-Gewerbekunden.",
    categories: ["Wespen", "Hornissen", "Ratten", "Mäuse", "Bettwanzen", "Schaben", "Ameisen", "Tauben", "Motten", "Flöhe", "Holzschädlinge", "Sonstiges"],
    roleLabels: { FIELD_TECH: "Schädlingsexperte", EMERGENCY_TECH: "Notdienst", SPECIALIST: "HACCP-Spezialist", BACKOFFICE: "Backoffice" },
    customerTypeLabels: { PRIVATE: "Privat", BUSINESS: "Gewerbe (HACCP)", PROPERTY_MANAGEMENT: "Hausverwaltung" },
    specialistCustomerTypes: ["BUSINESS", "PROPERTY_MANAGEMENT"],
    urgency: {
      critical: [...COMMON_CRITICAL, "allergi", "anaphyla", "gestochen", "baby", "säugling", "kita", "kindergarten", "schule", "krankenhaus", "klinik", "pflegeheim"],
      high: ["restaurant", "küche", "gastro", "lebensmittel", "bäckerei", "metzgerei", "kantine", "hotel", "haccp", "gesundheitsamt", "kontrolle", "audit", "kinderzimmer", "schlafzimmer", "eingang", "massenhaft", "überall"],
      low: COMMON_LOW,
      highCategories: ["Wespen", "Hornissen"],
      businessHighCategories: ["Ratten", "Mäuse", "Schaben"],
    },
    promptContext:
      "Fachbetrieb für Schädlingsbekämpfung. Kläre: welcher Schädling, wo genau (Wohnung, Küche, Dachboden, Gewerbefläche), seit wann, wie stark. " +
      "Frage nach Kindern, Allergikern und ob es ein Lebensmittelbetrieb ist. Wespen-/Hornissennester nicht selbst entfernen lassen; Hornissen sind geschützt.",
    intakeQuestions: ["Welcher Schädling?", "Wo genau?", "Seit wann und wie stark?", "Kinder, Allergiker oder Lebensmittelbetrieb?"],
    safetyRules: ["Keine Anleitungen zum Einsatz von Giften oder Bekämpfungsmitteln geben.", "Betroffene Stellen bis zum Einsatz nicht selbst behandeln lassen."],
    defaultDurationMin: 60,
    jobNoun: "Einsatz",
  },
  trades: {
    key: "trades",
    label: "Handwerk (SHK, Elektro, Dach)",
    description: "Sanitär, Heizung, Elektro, Dach – mit Notdienst bei Wasser, Strom, Gas.",
    categories: ["Rohrbruch", "Verstopfung", "Heizungsausfall", "Warmwasser", "Elektrik", "Stromausfall", "Dach/Undicht", "Wartung", "Montage", "Sonstiges"],
    roleLabels: { FIELD_TECH: "Monteur", EMERGENCY_TECH: "Notdienst", SPECIALIST: "Objektbetreuer", BACKOFFICE: "Büro" },
    customerTypeLabels: { PRIVATE: "Privat", BUSINESS: "Gewerbe", PROPERTY_MANAGEMENT: "Hausverwaltung" },
    specialistCustomerTypes: ["PROPERTY_MANAGEMENT"],
    urgency: {
      critical: [...COMMON_CRITICAL, "gasgeruch", "nach gas", "gasleck", "gas strömt", "kabelbrand", "funken", "rauch", "wasser läuft", "überschwemmung", "steht unter wasser"],
      high: ["rohrbruch", "kein warmwasser", "heizung aus", "heizung kalt", "kein strom", "sicherung fliegt", "undicht", "tropft", "senioren", "baby"],
      low: COMMON_LOW,
      highCategories: ["Rohrbruch", "Heizungsausfall", "Stromausfall"],
      businessHighCategories: ["Verstopfung", "Elektrik"],
    },
    promptContext:
      "Handwerksbetrieb. Kläre Art des Schadens, betroffene Räume, ob Wasser/Strom/Gas abgestellt werden kann, Gerätetyp und Baujahr falls bekannt. " +
      "Bei Gasgeruch: Fenster öffnen, keine Schalter betätigen, Haus verlassen und Gasversorger-Notruf bzw. 112 anrufen.",
    intakeQuestions: ["Was genau ist defekt?", "Seit wann?", "Kann Wasser/Strom abgestellt werden?", "Gerätetyp/Hersteller?"],
    safetyRules: ["Bei Gasgeruch immer zuerst auf Sicherheit und den Notruf verweisen.", "Keine Reparaturanleitungen an Strom- oder Gasanlagen geben."],
    defaultDurationMin: 90,
    jobNoun: "Auftrag",
  },
  general: {
    key: "general",
    label: "Allgemeiner Dienstleister",
    description: "Universelle Vorlage für Terminvergabe, Rückrufe und Anfragen.",
    categories: ["Terminanfrage", "Rückrufbitte", "Reklamation", "Angebot", "Sonstiges"],
    roleLabels: { ...DEFAULT_ROLE_LABEL },
    customerTypeLabels: { ...DEFAULT_CUSTOMER_TYPE_LABEL },
    specialistCustomerTypes: ["BUSINESS"],
    urgency: {
      critical: COMMON_CRITICAL,
      high: ["dringend", "sofort", "heute noch", "reklamation", "beschwerde"],
      low: COMMON_LOW,
      highCategories: ["Reklamation"],
      businessHighCategories: [],
    },
    promptContext: "Dienstleistungsunternehmen. Kläre Anliegen, gewünschten Zeitraum und Kontaktdaten.",
    intakeQuestions: ["Worum geht es?", "Bis wann wird es benötigt?"],
    safetyRules: [],
    defaultDurationMin: 60,
    jobNoun: "Termin",
  },
};

export const DEFAULT_TEMPLATE = "general";

export function getTemplate(key: string | null | undefined): IndustryTemplate {
  return TEMPLATES[key ?? ""] ?? TEMPLATES[DEFAULT_TEMPLATE];
}

export const TEMPLATE_OPTIONS = Object.values(TEMPLATES).map((t) => ({ key: t.key, label: t.label, description: t.description }));
