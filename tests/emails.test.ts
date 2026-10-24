import { describe, expect, it } from "vitest";
import type { Customer } from "@prisma/client";
import { resolveConfig } from "@/lib/tenant/settings";
import { technicianBriefingEmail, type MailCtx } from "@/lib/services/emails";

const ctx = (over: Partial<MailCtx> = {}): MailCtx => ({
  tenant: { name: "Krüger", timezone: "Europe/Berlin" },
  cfg: resolveConfig({ industry: "pest_control", settings: {} }),
  customer: { name: "Maria Weber", companyName: null, phone: "+4915200000011", email: null, address: "Invalidenstr. 12", postalCode: "10115", customerType: "PRIVATE", status: "EXISTING" } as Customer,
  employee: null,
  category: "Wespen",
  urgency: "HIGH",
  summary: "Kind allergisch, Nest am Rollladenkasten",
  ticketId: "ckticket000000000001",
  ...over,
});

// T-SEC-32: Gesprächsinhalt nur, wenn der Kunde es so eingestellt hat
describe("Mitarbeiter-E-Mail", () => {
  it("enthält standardmäßig die Zusammenfassung", () => {
    expect(technicianBriefingEmail(ctx()).html).toContain("Kind allergisch");
    expect(resolveConfig({ industry: "general", settings: {} }).settings.notifications.summaryInNotifications).toBe(true);
  });

  it("lässt die Zusammenfassung weg und verlinkt ins Portal, wenn abgeschaltet", () => {
    const html = technicianBriefingEmail(ctx({ includeSummary: false, portalUrl: "https://app.example/?ticket=x" })).html;
    expect(html).not.toContain("Kind allergisch");
    expect(html).toContain("https://app.example/?ticket=x");
  });
});
