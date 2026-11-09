import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { hashToken, tokenValido } from "@/app/lib/tessera-token";
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const risposta = (body: object, status: number) => Response.json(body, { status, headers });
export async function POST(request: Request) {
  try {
    if ((request.headers.get("content-length") && Number(request.headers.get("content-length")) > 1024)) return risposta({ errore: "Collegamento non disponibile o scaduto." }, 404);
    const body = await request.text();
    if (body.length > 1024) return risposta({ errore: "Collegamento non disponibile o scaduto." }, 404);
    let token: unknown;
    try { token = JSON.parse(body).token; } catch { return risposta({ errore: "Collegamento non disponibile o scaduto." }, 404); }
    if (!tokenValido(token)) return risposta({ errore: "Collegamento non disponibile o scaduto." }, 404);
    const client = createSupabaseServerClient();
    if (!client) return risposta({ errore: "Servizio temporaneamente non disponibile. Riprova o contatta la centrale." }, 503);
    const { data, error } = await client.rpc("roma_rta_leggi_tessera", { p_hash: hashToken(token) });
    if (error) return risposta({ errore: "Servizio temporaneamente non disponibile. Riprova o contatta la centrale." }, 503);
    const tessera = data?.[0];
    if (!tessera) return risposta({ errore: "Collegamento non disponibile o scaduto. Contatta la centrale." }, 404);
    // Proiezione esplicita anche sul confine HTTP.
    return risposta({ tessera: { nome: tessera.nome, cognome: tessera.cognome, numero: tessera.numero, anno: tessera.anno, emissione: tessera.emissione, scadenza: tessera.scadenza } }, 200);
  } catch { return risposta({ errore: "Servizio temporaneamente non disponibile. Riprova o contatta la centrale." }, 503); }
}
