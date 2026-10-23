import { describe, expect, it } from "vitest";
import { assessUrgency } from "@/lib/urgency";

describe("assessUrgency", () => {
  it("erkennt Notfälle", () => {
    expect(assessUrgency({ pestType: "Wespen", description: "Mein Sohn ist allergisch und wurde gestochen" })).toBe("CRITICAL");
    expect(assessUrgency({ pestType: "Wespen", description: "Nest in der Kita" })).toBe("CRITICAL");
  });
  it("stuft Gastronomie/HACCP hoch", () => {
    expect(assessUrgency({ pestType: "Schaben", description: "in der Küche", customerType: "B2B_HACCP" })).toBe("HIGH");
    expect(assessUrgency({ pestType: "Ratten", customerType: "B2B_HACCP" })).toBe("HIGH");
  });
  it("erkennt Beratung als niedrig", () => {
    expect(assessUrgency({ pestType: "Ameisen", description: "nur eine Beratung, kein Notfall" })).toBe("LOW");
  });
  it("übernimmt die höhere KI-Einschätzung", () => {
    expect(assessUrgency({ pestType: "Ameisen", description: "Beratung", aiUrgency: "HIGH" })).toBe("HIGH");
    expect(assessUrgency({ pestType: "Wespen", description: "allergisch", aiUrgency: "LOW" })).toBe("CRITICAL");
  });
});
