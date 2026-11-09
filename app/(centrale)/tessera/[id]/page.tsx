"use client";

import React, { useEffect, useState, Suspense } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import { associazione } from "@/app/lib/associazione";
import { useParams } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";

function TesseraContent() {
  const params = useParams();
  const [paziente, setPaziente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [tentativo, setTentativo] = useState(0);
  useEffect(() => {
    async function fetchPaziente() {
      if (!params?.id) return;
      setLoading(true);
      setErroreCaricamento(null);
      try {
        const { data, error } = await supabase
          .from("pazienti")
          .select("id, nome, cognome, data_nascita, codice_fiscale, numero_tessera, anno_tessera, data_tesseramento")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setPaziente(data);
      } catch (err: any) {
        console.error(err);
        setErroreCaricamento("Impossibile leggere la tessera. Verifica il collegamento e riprova.");
      } finally {
        setLoading(false);
      }
    }
    fetchPaziente();
  }, [params, tentativo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="animate-spin text-blue-500" size={36} />
        <p className="text-sm font-semibold">Generazione tessera ufficiale...</p>
      </div>
    );
  }

  if (erroreCaricamento) return <ErroreCaricamento messaggio={erroreCaricamento} onRiprova={() => setTentativo((n) => n + 1)} />;

  if (!paziente) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow text-center border border-slate-200">
          <p className="font-bold text-slate-800">Tessera non trovata o non ancora attiva.</p>
        </div>
      </div>
    );
  }

  const annoTessera = paziente.anno_tessera;
  const dataTesseramento = paziente.data_tesseramento?.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  const dataRilascio = dataTesseramento
    ? `${dataTesseramento[3]}/${dataTesseramento[2]}/${dataTesseramento[1]}`
    : "Data non disponibile";
  const cf = (paziente.codice_fiscale || "").toUpperCase();

  return (
    <div data-stampa-tessera className="rta-tessera-page min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
      <article aria-label="Tessera associativa del socio" className="rta-tessera-document mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 border-t-4 border-t-blue-900 bg-white p-5 text-slate-900 shadow-lg sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Tessera associativa</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight text-blue-950 sm:text-4xl">{associazione.denominazione}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Ente accreditato</span>
              <img src={associazione.logoRegione} alt="Regione Lazio" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-12 w-24 object-cover" />
            </div>
          </div>
          <img src={associazione.logoRta} alt="Logo Roma R.T.A." onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-24 w-20 shrink-0 object-contain sm:h-28 sm:w-24" />
        </header>

        <div className="space-y-2 py-5 text-xs leading-relaxed text-slate-700">
          <p className="font-bold text-blue-950">{associazione.denominazioneCompleta}</p>
          <p className="font-semibold">{associazione.distaccamento}</p>
          <p>{associazione.indirizzo}</p>
        </div>

        <section aria-labelledby="socio-titolo" className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-900">Socio sostenitore</p>
            <p className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-bold text-white">Tessera N&deg; {paziente.numero_tessera ?? "Non disponibile"}</p>
          </div>
          <h2 id="socio-titolo" className="mt-5 break-words text-2xl font-bold uppercase leading-snug text-blue-950 sm:text-3xl">{paziente.nome} {paziente.cognome}</h2>
          <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-slate-600">Anno associativo</dt><dd className="mt-1 font-bold text-slate-900">{annoTessera || "Anno non disponibile"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-600">Data di emissione</dt><dd className="mt-1 font-bold text-slate-900">{dataRilascio}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-600">Scadenza</dt><dd className="mt-1 font-semibold">{annoTessera ? `31/12/${annoTessera}` : "Anno non disponibile"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-600">Data di nascita</dt><dd className="mt-1 font-semibold">{paziente.data_nascita ? new Date(paziente.data_nascita).toLocaleDateString("it-IT") : "Non disponibile"}</dd></div>
          </dl>
          <div className="mt-5 border-t border-blue-200 pt-4">
            <p className="text-xs font-semibold text-slate-600">Codice fiscale</p>
            <p className="mt-1 break-all font-mono text-sm font-semibold tracking-wider text-blue-950">{cf || "Non disponibile"}</p>
          </div>
        </section>

        <footer className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-700">
          <p>Tel. {associazione.telefono} | Cell. {associazione.cellulare}</p>
          <p>{associazione.email}</p>
          <p className="font-semibold">C.F. {associazione.codiceFiscale} | P. IVA {associazione.partitaIva}</p>
          <div className="space-y-1 text-[10px] text-slate-600">{associazione.iscrizioni.map((iscrizione) => <p key={iscrizione}>{iscrizione}</p>)}</div>
        </footer>
      </article>

      <div data-no-stampa className="mx-auto mt-5 max-w-3xl space-y-3 text-center print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto">
          <Printer size={18} /> Stampa / Salva tessera PDF
        </button>
        <p className="text-xs leading-relaxed text-slate-600">Nel menu di stampa scegli A4 verticale oppure Salva come PDF. Disattiva intestazioni e pie di pagina del browser.</p>
      </div>
    </div>
  );
}

export default function TesseraSocioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="animate-spin text-blue-500" size={36} />
        <p className="text-sm">Caricamento tessera...</p>
      </div>
    }>
      <TesseraContent />
    </Suspense>
  );
}
