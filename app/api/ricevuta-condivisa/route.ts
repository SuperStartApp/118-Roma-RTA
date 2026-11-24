import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { creaPdfRicevuta, type Ricevuta } from "@/app/lib/ricevute";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { hashToken, tokenValido } from "@/app/lib/tessera-token";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};
const scaduto = () => Response.json({ errore: "Collegamento non disponibile, scaduto o revocato." }, { status: 404, headers });
const indisponibile = () => Response.json({ errore: "PDF temporaneamente non disponibile. Riprova." }, { status: 503, headers });

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 1024) return scaduto();
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > 1024) return scaduto();
  let token: unknown;
  try { token = JSON.parse(raw)?.token; } catch { return scaduto(); }
  if (!tokenValido(token)) return scaduto();

  try {
    const client = createSupabaseServerClient();
    if (!client) return indisponibile();
    const { data, error } = await client.rpc("roma_rta_leggi_ricevuta_condivisa", { p_hash: hashToken(token) });
    if (error) return indisponibile();
    const ricevuta = data?.[0] as Ricevuta | undefined;
    if (!ricevuta) return scaduto();
    const logo = await readFile(join(process.cwd(), "public", "roma-rta-logo.jpeg"));
    const file = await creaPdfRicevuta(ricevuta, ricevuta, logo);
    return new Response(file, { headers: { ...headers, "Content-Type": "application/pdf" } });
  } catch {
    return indisponibile();
  }
}
