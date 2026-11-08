import type { SupabaseClient } from "@supabase/supabase-js";
import { costoValido, rimborsoPendente, type DatiEconomiciPrenotazione } from "./stato-prenotazione";

type Prenotazione = DatiEconomiciPrenotazione & { id: string };
const colonne = "id, costo, metodo_pagamento, pagato, annullata_il, rimborso_effettuato_il";

function verificaEsito(data: Prenotazione | null, error: { message: string } | null) {
  if (error) throw new Error("Impossibile confermare l’esito. Verifica connessione e permessi e aggiorna l’elenco prima di riprovare.");
  if (!data) throw new Error("Nessuna modifica confermata: la corsa potrebbe essere già aggiornata o non modificabile. Aggiorna l’elenco.");
  return data;
}

export async function annullaPrenotazione(client: SupabaseClient, p: Prenotazione) {
  if (p.annullata_il || p.rimborso_effettuato_il || typeof p.pagato !== "boolean") {
    throw new Error("La prenotazione non è annullabile. Aggiorna l’elenco.");
  }
  let query = client.from("prenotazioni")
    .update({ annullata_il: new Date().toISOString() })
    .eq("id", p.id).is("annullata_il", null).is("rimborso_effettuato_il", null)
    .eq("pagato", p.pagato);
  query = p.costo === null ? query.is("costo", null) : query.eq("costo", p.costo);
  const { data, error } = await query.select(colonne).maybeSingle();
  const confermata = verificaEsito(data, error);
  if (!confermata.annullata_il) throw new Error("Annullamento non confermato dal database.");
  return confermata;
}

export async function registraRimborso(client: SupabaseClient, p: Prenotazione) {
  if (!rimborsoPendente(p) || !costoValido(p.costo)) {
    throw new Error("Il rimborso non è registrabile: verifica stato e importo originale.");
  }
  const { data, error } = await client.from("prenotazioni")
    .update({ rimborso_effettuato_il: new Date().toISOString() })
    .eq("id", p.id).eq("annullata_il", p.annullata_il).eq("pagato", true)
    .eq("costo", p.costo).is("rimborso_effettuato_il", null)
    .select(colonne).maybeSingle();
  const confermata = verificaEsito(data, error);
  if (!confermata.rimborso_effettuato_il || !confermata.annullata_il || confermata.pagato !== true) {
    throw new Error("Rimborso non confermato dal database.");
  }
  return confermata;
}

export async function cambiaPagamento(client: SupabaseClient, p: Prenotazione) {
  if (p.annullata_il || p.rimborso_effettuato_il || typeof p.pagato !== "boolean") {
    throw new Error("Il pagamento di una prenotazione annullata non può essere modificato.");
  }
  const { data, error } = await client.from("prenotazioni")
    .update({ pagato: !p.pagato })
    .eq("id", p.id).is("annullata_il", null).is("rimborso_effettuato_il", null)
    .eq("pagato", p.pagato).select(colonne).maybeSingle();
  const confermata = verificaEsito(data, error);
  if (confermata.pagato !== !p.pagato || confermata.annullata_il) {
    throw new Error("Modifica del pagamento non confermata dal database.");
  }
  return confermata;
}
