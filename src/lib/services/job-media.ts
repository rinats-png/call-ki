/** Bild sicher ausliefern: kein Sniffing, kein Skript, nur privat cachen. */
export function imageResponse(mime: string, data: Uint8Array) {
  return new Response(Buffer.from(data), {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'", "Content-Disposition": "inline" },
  });
}
