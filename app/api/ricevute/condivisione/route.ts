import { createClient } from "@supabase/supabase-js";
import { idPazienteValido } from "@/app/lib/id-paziente";
import { hashToken, nuovoToken } from "@/app/lib/tessera-token";

const risposta = (body: object, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ") || !bearer.slice(7).trim()) {
    return risposta({ errore: "Accedi nuovamente alla centrale." }, 401);
  }
  if (Number(request.headers.get("content-length")) > 1024) return risposta({ errore: "Richiesta non valida." }, 400);
  try {
    const raw = await request.text();
    const body = raw.length <= 1024 ? JSON.parse(raw) : null;
    if (!idPazienteValido(body?.id) || !["crea", "revoca"].includes(body.azione)) {
      return risposta({ errore: "Richiesta non valida." }, 400);
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return risposta({ errore: "Condivisione non disponibile." }, 503);
    const client = createClient(url, key, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: sessione, error: authError } = await client.auth.getUser(bearer.slice(7));
    if (authError?.status === 0 || (authError?.status ?? 0) >= 500) return risposta({ errore: "Verifica sessione non disponibile." }, 503);
    if (authError || !sessione.user) return risposta({ errore: "Accedi nuovamente alla centrale." }, 401);
    const token = body.azione === "crea" ? nuovoToken() : null;
    const { data, error } = token
      ? await client.rpc("roma_rta_condividi_ricevuta", { p_ricevuta: body.id, p_hash: hashToken(token) })
      : await client.rpc("roma_rta_revoca_ricevuta", { p_ricevuta: body.id });
    if (error?.code === "42501") return risposta({ errore: "Operatore non abilitato." }, 403);
    if (error?.code === "P0002") return risposta({ errore: "Ricevuta non disponibile." }, 404);
    if (error || (token && !data)) return risposta({ errore: "Condivisione non disponibile. Riprova." }, 503);
    return risposta(token ? { token, scadenza: data } : { revocato: true }, 200);
  } catch (error) {
    if (error instanceof SyntaxError) return risposta({ errore: "Richiesta non valida." }, 400);
    return risposta({ errore: "Condivisione non disponibile. Riprova." }, 503);
  }
}
