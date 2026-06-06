import { NextRequest, NextResponse } from "next/server";

// ─── Minimal DER/ASN.1 encoder ───────────────────────────────────────────────

function derLength(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derTLV(tag: number, value: Uint8Array): Uint8Array {
  const lenBytes = derLength(value.length);
  const result = new Uint8Array(1 + lenBytes.length + value.length);
  result[0] = tag;
  result.set(lenBytes, 1);
  result.set(value, 1 + lenBytes.length);
  return result;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function buildTSQ(hash: Uint8Array): Uint8Array {
  // version INTEGER v1(1)
  const version = new Uint8Array([0x02, 0x01, 0x01]);

  // SHA-256 OID 2.16.840.1.101.3.4.2.1
  const sha256OID = derTLV(0x06, new Uint8Array([
    0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
  ]));
  const algId = derTLV(0x30, concat(sha256OID, new Uint8Array([0x05, 0x00])));
  const msgImprint = derTLV(0x30, concat(algId, derTLV(0x04, hash)));

  // nonce (8 random positive bytes)
  const nonceBytes = new Uint8Array(8);
  crypto.getRandomValues(nonceBytes);
  nonceBytes[0] &= 0x7f;
  const nonce = derTLV(0x02, nonceBytes);

  // certReq BOOLEAN TRUE
  const certReq = new Uint8Array([0x01, 0x01, 0xff]);

  return derTLV(0x30, concat(version, msgImprint, nonce, certReq));
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { hash } = (await req.json()) as { hash: string };
    if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
      return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
    }

    const hashBytes = new Uint8Array(Buffer.from(hash, "hex"));
    const timestamp = new Date().toISOString();

    // Try RFC 3161 TSAs (may be blocked from cloud IPs)
    const tsq = buildTSQ(hashBytes);
    const tsas = [
      "https://freetsa.org/tsr",
      "http://timestamp.sectigo.com",
      "http://time.certum.pl",
    ];

    for (const tsaUrl of tsas) {
      try {
        const tsaRes = await fetch(tsaUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/timestamp-query",
            "User-Agent": "e-sign-pdf/1.0",
          },
          body: Buffer.from(tsq),
          signal: AbortSignal.timeout(8_000),
        });
        if (tsaRes.ok) {
          const tsrBytes = await tsaRes.arrayBuffer();
          const tsrBase64 = Buffer.from(tsrBytes).toString("base64");
          return NextResponse.json({ tsr: tsrBase64, timestamp, source: "rfc3161" });
        }
      } catch { /* try next */ }
    }

    // Fallback: OpenTimestamps via Bitcoin calendar servers (no IP restriction)
    try {
      const otsRes = await fetch("https://alice.btc.calendar.opentimestamps.org/digest", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: hashBytes,
        signal: AbortSignal.timeout(8_000),
      });
      if (otsRes.ok) {
        const otsBytes = await otsRes.arrayBuffer();
        const otsBase64 = Buffer.from(otsBytes).toString("base64");
        return NextResponse.json({ tsr: otsBase64, timestamp, source: "opentimestamps" });
      }
    } catch { /* continue */ }

    // Last fallback: server-signed timestamp (integrity proof via hash only)
    // The SHA-256 hash stored in DB is the tamper evidence regardless
    return NextResponse.json({ tsr: null, timestamp, source: "server" });
  } catch (err) {
    console.error("Timestamp API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
