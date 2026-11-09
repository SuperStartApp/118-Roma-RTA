import { supabase } from "./supabase";
export async function condividiTessera(pazienteId: string, azione: "crea" | "revoca") {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Accedi nuovamente alla centrale.");
  const response = await fetch("/api/tessere/condivisione", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token }, body: JSON.stringify({ pazienteId, azione }), cache: "no-store" });
  const risultato = await response.json();
  if (!response.ok) throw new Error(risultato.errore || "Condivisione non riuscita.");
  return risultato as { link?: string; scadenza?: string; revocato?: boolean };
}
