export const CUSTOMER_TYPES = ["PRIVATE", "BUSINESS", "PROPERTY_MANAGEMENT"] as const;
export const CUSTOMER_STATUS = ["NEW", "EXISTING"] as const;
export const EMPLOYEE_ROLES = ["FIELD_TECH", "EMERGENCY_TECH", "SPECIALIST", "BACKOFFICE"] as const;
export const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TICKET_STATUS = ["PENDING", "PROCESSED", "ESCALATED", "CLOSED"] as const;
export const USER_ROLES = ["PLATFORM_ADMIN", "TENANT_ADMIN", "TENANT_USER"] as const;
export const TENANT_STATUS = ["ONBOARDING", "ACTIVE", "PAUSED"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type TicketStatus = (typeof TICKET_STATUS)[number];
export type UserRole = (typeof USER_ROLES)[number];

export const URGENCY_RANK: Record<Urgency, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export const DEFAULT_ROLE_LABEL: Record<EmployeeRole, string> = {
  FIELD_TECH: "Techniker",
  EMERGENCY_TECH: "Notdienst",
  SPECIALIST: "Gewerbe-Spezialist",
  BACKOFFICE: "Backoffice",
};

export const DEFAULT_CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  PRIVATE: "Privat",
  BUSINESS: "Gewerbe",
  PROPERTY_MANAGEMENT: "Hausverwaltung",
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  PLATFORM_ADMIN: "Plattform-Admin",
  TENANT_ADMIN: "Administrator",
  TENANT_USER: "Mitarbeiter",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  PENDING: "Offen",
  PROCESSED: "Eingeplant",
  ESCALATED: "Eskaliert",
  CLOSED: "Erledigt",
};
