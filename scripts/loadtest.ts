/**
 * Lasttest der Sprach-KI-Schnittstelle: viele gleichzeitige „Anrufe“, jeder mit dem typischen
 * Ablauf identify_caller → save_customer → find_technician → book_appointment.
 * Misst Antwortzeiten (Ziel laut 18-qualitaetsziele.md: p95 < 1 s) und Fehler.
 *
 *   LOAD_BASE_URL=http://localhost:3100 DATABASE_URL=postgresql://… VOICE_TOOL_SECRET_SIP=… \
 *     CALLS=30 npx tsx scripts/loadtest.ts
 *
 * Legt einen Test-Mandanten „Lasttest“ an (bzw. nutzt ihn wieder) – nie gegen Produktion!
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.LOAD_BASE_URL ?? "http://localhost:3100";
const SECRET = process.env.VOICE_TOOL_SECRET_SIP ?? "";
const CALLS = Number(process.env.CALLS ?? 30);
const P95_LIMIT_MS = Number(process.env.P95_LIMIT_MS ?? 1000);
const prisma = new PrismaClient();

async function seed() {
  const slug = "lasttest";
  const tenant = (await prisma.tenant.findUnique({ where: { slug } })) ?? (await prisma.tenant.create({ data: { name: "Lasttest GmbH", slug, industry: "trades", status: "ACTIVE" } }));
  const e164 = "+493099990000";
  if (!(await prisma.phoneNumber.findUnique({ where: { e164 } }))) await prisma.phoneNumber.create({ data: { tenantId: tenant.id, e164 } });
  if (!(await prisma.employee.count({ where: { tenantId: tenant.id } }))) {
    await prisma.employee.createMany({ data: [1, 2, 3].map((i) => ({ tenantId: tenant.id, name: `Techniker ${i}`, role: "FIELD_TECH", servicePostalCodes: "*" })) });
  }
  const calls = [];
  for (let i = 0; i < CALLS; i++) {
    calls.push(await prisma.call.create({ data: { tenantId: tenant.id, fromNumber: `+4917${String(Date.now() % 1e7).padStart(7, "0")}${String(i).padStart(3, "0")}`, toNumber: e164, status: "IN_PROGRESS", provider: "custom" } }));
  }
  return calls;
}

const times: Record<string, number[]> = {};
let errors = 0;
async function tool(name: string, callRef: string, args: Record<string, unknown>) {
  const t = performance.now();
  const res = await fetch(`${BASE}/api/voice/tools/${name}`, { method: "POST", headers: { "content-type": "application/json", "x-tool-secret": SECRET }, body: JSON.stringify({ ...args, call_ref: callRef }) });
  const ms = performance.now() - t;
  (times[name] ??= []).push(ms);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok || body.error) {
    errors++;
    if (errors <= 5) console.error(`Fehler ${name}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

async function oneCall(callRef: string, i: number) {
  await tool("identify_caller", callRef, {});
  await tool("save_customer", callRef, { name: `Kunde ${i}`, address: `Teststraße ${i}`, postalCode: "10115" });
  await tool("find_technician", callRef, { description: "Heizung ausgefallen", category: "Heizung" });
  await tool("book_appointment", callRef, { description: "Heizung ausgefallen", category: "Heizung" });
}

const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];

async function main() {
  if (!SECRET) throw new Error("VOICE_TOOL_SECRET_SIP fehlt");
  const calls = await seed();
  const t0 = performance.now();
  await Promise.all(calls.map((c, i) => oneCall(c.id, i)));
  const total = performance.now() - t0;
  const all = Object.values(times).flat();
  console.log(`\n${CALLS} gleichzeitige Anrufe, ${all.length} Tool-Aufrufe in ${(total / 1000).toFixed(1)} s, Fehler: ${errors}`);
  console.log("Tool              p50     p95     p99     max");
  for (const [name, a] of Object.entries(times)) {
    console.log(`${name.padEnd(17)} ${pct(a, 50).toFixed(0).padStart(4)} ms ${pct(a, 95).toFixed(0).padStart(4)} ms ${pct(a, 99).toFixed(0).padStart(4)} ms ${Math.max(...a).toFixed(0).padStart(4)} ms`);
  }
  const p95 = pct(all, 95);
  console.log(`Gesamt p95: ${p95.toFixed(0)} ms (Ziel < ${P95_LIMIT_MS} ms)`);
  await prisma.call.updateMany({ where: { id: { in: calls.map((c) => c.id) } }, data: { status: "ENDED", endedAt: new Date() } });
  await prisma.$disconnect();
  if (errors || p95 > P95_LIMIT_MS) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
