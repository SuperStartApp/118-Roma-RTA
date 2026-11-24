import { sessioneAutista, noStore } from "@/app/lib/autista-sessione";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export async function GET() {
  const sessione = await sessioneAutista();
  if (!sessione) return Response.json({ errore: "Non autorizzato" }, { status: 401, headers: noStore });
  const db = createSupabaseServerClient();
  if (!db) return Response.json({ errore: "Servizio non disponibile" }, { status: 503, headers: noStore });

  const { data, error } = await db.from("prenotazioni")
    .select(`
      id, autista_id, data_appuntamento, ora_appuntamento, ora_inizio_effettiva, ora_fine_effettiva, annullata_il,
      partenza_via, partenza_civico, partenza_citta, partenza_piano, partenza_ascensore, partenza_dettagli_ospedale,
      arrivo_via, arrivo_civico, arrivo_citta, arrivo_piano, arrivo_ascensore, arrivo_dettagli_ospedale,
      serve_ossigeno, serve_medico, note, assegnazioni:roma_rta_prenotazioni_autisti!inner(),
      pazienti(id,nome,cognome,telefono,patologia,numero_tessera,anno_tessera)
    `)
    .eq("assegnazioni.autista_id", sessione.autista_id)
    .is("annullata_il", null)
    .order("data_appuntamento", { ascending: true })
    .order("ora_appuntamento", { ascending: true })
    .limit(300);
  if (error) return Response.json({ errore: "Impossibile caricare le corse" }, { status: 500, headers: noStore });
  return Response.json({ corse: data ?? [] }, { headers: noStore });
}
