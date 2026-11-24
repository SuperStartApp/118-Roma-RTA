import { sessioneAutista, origineValida, noStore } from "@/app/lib/autista-sessione";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export async function POST(req: Request) {
  if (!origineValida(req)) return Response.json({ errore: "Origine non valida" }, { status: 403, headers: noStore });
  const sessione = await sessioneAutista();
  if (!sessione) return Response.json({ errore: "Non autorizzato" }, { status: 401, headers: noStore });

  const body = await req.json().catch(() => null);
  const id = body?.id;
  const tipo = body?.tipo;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || (tipo !== "inizio" && tipo !== "fine")) {
    return Response.json({ errore: "Dati non validi" }, { status: 400, headers: noStore });
  }

  const db = createSupabaseServerClient();
  if (!db) return Response.json({ errore: "Servizio non disponibile" }, { status: 503, headers: noStore });
  const { data, error } = await db.rpc("roma_rta_registra_ora", { p_id: id, p_autista: sessione.autista_id, p_tipo: tipo });
  if (error) return Response.json({ errore: "Errore di aggiornamento" }, { status: 500, headers: noStore });
  if (data !== true) {
    return Response.json({ errore: "Corsa non assegnata, annullata o già aggiornata" }, { status: 409, headers: noStore });
  }
  return Response.json({ ok: true }, { headers: noStore });
}
