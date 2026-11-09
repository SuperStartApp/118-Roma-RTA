import { createClient } from "@supabase/supabase-js";
import { hashToken, nuovoToken } from "@/app/lib/tessera-token";
import { creaLinkTesseraPubblica } from "@/app/lib/link-tessera";
const headers = { "Cache-Control": "no-store, private" };
const risposta = (body: object, status: number) => Response.json(body, { status, headers });
function erroreRpc(error: { code?: string }) {
  if (error.code === "42501") return risposta({ errore: "Operatore non abilitato." }, 403);
  if (error.code === "22023") return risposta({ errore: "Tessera assente, scaduta o dati non validi." }, 400);
  if (error.code === "P0002") return risposta({ errore: "Paziente non disponibile." }, 404);
  if (["55P03", "40P01", "40001"].includes(error.code || "")) return risposta({ errore: "Operazione concorrente: aggiorna e riprova. Un nuovo tentativo di creazione sostituisce il link precedente." }, 409);
  return risposta({ errore: "Operazione non riuscita. Verifica la configurazione e riprova." }, 503);
}
export async function POST(request: Request) {
  try {
    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ")) return risposta({ errore: "Accesso richiesto." }, 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return risposta({ errore: "Condivisione non configurata." }, 503);
    const client = createClient(url, key, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: user, error: authError } = await client.auth.getUser(bearer.slice(7));
    if (authError || !user.user) return risposta({ errore: "Sessione non valida." }, 401);
    const { data: abilitato, error: ruoloError } = await client.rpc("roma_rta_operatore_abilitato");
    if (ruoloError) return risposta({ errore: "Verifica operatore non disponibile. Contatta l’amministratore per controllare la configurazione degli accessi." }, 503);
    if (abilitato !== true) return risposta({ errore: "Operatore non abilitato." }, 403);
    const raw = await request.text();
    if (raw.length > 1024) return risposta({ errore: "Richiesta non valida." }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return risposta({ errore: "Richiesta non valida." }, 400); }
    if (!body || !["crea", "revoca"].includes(body.azione)) return risposta({ errore: "Richiesta non valida." }, 400);
    if (typeof body.pazienteId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.pazienteId)) {
      return risposta({ errore: "Identificativo paziente non compatibile con la condivisione pubblica: è richiesto un UUID. Contatta l’amministratore per verificare schema e versione del gestionale. Nessun link creato." }, 400);
    }
    if (body.azione === "revoca") {
      const { error } = await client.rpc("roma_rta_revoca_tessera", { p_paziente: body.pazienteId });
      return error ? erroreRpc(error) : risposta({ revocato: true }, 200);
    }
    const token = nuovoToken();
    const { data, error } = await client.rpc("roma_rta_condividi_tessera", { p_paziente: body.pazienteId, p_hash: hashToken(token) });
    if (error) return erroreRpc(error);
    if (!data) return risposta({ errore: "Link non creato: verifica tessera, anno e configurazione SQL." }, 503);
    return risposta({ link: creaLinkTesseraPubblica(token), scadenza: data }, 200);
  } catch { return risposta({ errore: "Operazione non riuscita. Riprova." }, 503); }
}
