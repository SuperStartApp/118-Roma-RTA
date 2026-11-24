"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DocumentoRicevuta from "@/components/DocumentoRicevuta";
import InviaRicevutaWhatsApp from "@/components/InviaRicevutaWhatsApp";
import { identificativoRicevuta, type Ricevuta } from "@/app/lib/ricevute";
import { formattaImporto } from "@/app/lib/stato-prenotazione";
import { supabase } from "@/app/lib/supabase";

const dimensionePagina = 25;
type VoceArchivio = Ricevuta & { prenotazioni: { pazienti: { telefono: string | null } | null } | null };

export default function ArchivioRicevute() {
  const [pagina, setPagina] = useState(0);
  const [risultato, setRisultato] = useState<{ pagina: number; documenti: VoceArchivio[]; totale: number; errore: boolean }>();
  const [aperta, setAperta] = useState<string>();
  const corrente = risultato?.pagina === pagina ? risultato : undefined;

  useEffect(() => {
    let attivo = true;
    const inizio = pagina * dimensionePagina;
    void supabase.from("roma_rta_ricevute").select("*, prenotazioni(pazienti(telefono))", { count: "exact" })
      .order("emessa_il", { ascending: false }).order("id")
      .range(inizio, inizio + dimensionePagina - 1).returns<VoceArchivio[]>().then(({ data, count, error }) => {
        if (attivo) setRisultato({ pagina, documenti: data || [], totale: count || 0, errore: !!error });
      });
    return () => { attivo = false; };
  }, [pagina]);

  return <div className="mx-auto max-w-4xl space-y-4 p-4">
    <h1 className="text-2xl font-bold text-slate-900">Archivio ricevute</h1>
    {!corrente ? <p role="status">Caricamento…</p> : corrente.errore ? <p role="alert">Archivio non disponibile.</p>
      : corrente.documenti.length === 0 ? <p>Nessuna ricevuta emessa.</p>
      : <ul className="space-y-2">
        {corrente.documenti.map((documento) => <li key={documento.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <strong>{identificativoRicevuta(documento)}</strong>
            <span>{documento.intestatario}</span>
            <span>{formattaImporto(documento.importo)}</span>
            <Link href={`/prenotazioni/${documento.prenotazione_id}`} className="text-blue-800 underline">Prenotazione</Link>
            <button type="button" aria-expanded={aperta === documento.id} className="text-blue-800 underline"
              onClick={() => setAperta(aperta === documento.id ? undefined : documento.id)}>PDF e condivisione</button>
          </div>
          <InviaRicevutaWhatsApp id={documento.id} telefonoProposto={documento.prenotazioni?.pazienti?.telefono} />
          {aperta === documento.id && <DocumentoRicevuta ricevuta={documento} />}
        </li>)}
      </ul>}
    {corrente && corrente.totale > dimensionePagina && <div className="flex items-center gap-3 text-sm">
      <button type="button" disabled={pagina === 0} className="underline disabled:opacity-40" onClick={() => setPagina(pagina - 1)}>Indietro</button>
      <span>Pagina {pagina + 1}</span>
      <button type="button" disabled={(pagina + 1) * dimensionePagina >= corrente.totale} className="underline disabled:opacity-40" onClick={() => setPagina(pagina + 1)}>Avanti</button>
    </div>}
  </div>;
}
