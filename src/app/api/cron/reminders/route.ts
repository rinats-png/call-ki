import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { runAppointmentReminders } from "@/lib/services/reminders";
import { runBillReminders } from "@/lib/services/bills";
import { runReviewRequests } from "@/lib/services/job-contact";
import { runTrialLifecycle } from "@/lib/trial";

export const dynamic = "force-dynamic";

/** Alle 15 Minuten per Cron: Terminerinnerungen, Zahlungserinnerungen, Bitte um Bewertung. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ...(await runAppointmentReminders()), bills: await runBillReminders(), reviews: await runReviewRequests(), trials: await runTrialLifecycle() });
}
