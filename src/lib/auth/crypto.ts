import crypto from "node:crypto";

/** Passwort-Hashing mit scrypt (Node-Bordmittel, keine native Abhängigkeit). */
const N = 16384, R = 8, P = 1, KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function scrypt(password: string, salt: Buffer, n = N, r = R, p = P, keylen = KEYLEN): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize("NFKC"), salt, keylen, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Mindestanforderung: 10 Zeichen. Länge schlägt Komplexitätsregeln (NIST 800-63B). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Das Passwort muss mindestens 10 Zeichen lang sein.";
  if (pw.length > 200) return "Das Passwort ist zu lang.";
  return null;
}
