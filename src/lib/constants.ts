export const CUSTOMER_TYPES = ["PRIVATE", "B2B_HACCP", "PROPERTY_MANAGEMENT"] as const;
export const CUSTOMER_STATUS = ["NEW", "EXISTING"] as const;
export const EMPLOYEE_ROLES = ["B2B_SPECIALIST", "EMERGENCY_TECH", "BACKOFFICE", "PEST_EXPERT"] as const;
export const PEST_TYPES = ["Wespen", "Ratten", "Mäuse", "Bettwanzen", "Schaben", "Ameisen", "Tauben", "Motten", "Flöhe", "Unbekannt"] as const;
export const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TICKET_STATUS = ["PENDING", "PROCESSED", "ESCALATED"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type TicketStatus = (typeof TICKET_STATUS)[number];

export const URGENCY_RANK: Record<Urgency, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export const ROLE_LABEL: Record<EmployeeRole, string> = {
  B2B_SPECIALIST: "B2B / HACCP",
  EMERGENCY_TECH: "Notdienst",
  BACKOFFICE: "Backoffice",
  PEST_EXPERT: "Schädlingsexperte",
};

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  PRIVATE: "Privat",
  B2B_HACCP: "Gewerbe (HACCP)",
  PROPERTY_MANAGEMENT: "Hausverwaltung",
};

export const TIMEZONE = process.env.BUSINESS_TIMEZONE ?? "Europe/Berlin";
