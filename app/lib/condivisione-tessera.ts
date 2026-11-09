import { supabase } from "./supabase";
import { verificaLinkTesseraPubblica } from "./link-tessera";
import { richiediIdPaziente } from "./id-paziente";
export async function condividiTessera(pazienteId: string, azione: "crea" | "revoca") {
  const id = richiediIdPaziente(pazienteId);
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Accedi nuovamente alla centrale.");
  let response: Response;
  try {
    response = await fetch("/api/tessere/condivisione", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token }, body: JSON.stringify({ pazienteId: id, azione }), cache: "no-store" });
  } catch { throw new Error("Esito della condivisione non confermato. Controlla la connessione e riprova; un nuovo tentativo sostituisce il link precedente."); }
  let risultato;
  try { risultato = await response.json(); }
  catch { throw new Error("Risposta del servizio non valida. Aggiorna la pagina e verifica la sessione; se persiste, contatta la centrale."); }
  if (!response.ok) throw new Error(risultato.errore || "Condivisione non riuscita.");
  if (azione === "crea") risultato.link = verificaLinkTesseraPubblica(risultato.link);
  return risultato as { link?: string; scadenza?: string; revocato?: boolean };
}
