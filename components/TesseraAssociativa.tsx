"use client";

import { Printer } from "lucide-react";
import { associazione } from "@/app/lib/associazione";

export type DatiTessera = {
  nome: string; cognome: string; numero: string | number | null;
  anno: number | null; emissione: string | null; scadenza: string | null;
};
type Props = { dati: DatiTessera } & (
  | { variante: "pubblica" }
  | { variante: "interna"; dettagliRiservati: { dataNascita?: string | null; codiceFiscale?: string | null } }
);

// Formato civile ISO: nessuna conversione di fuso per emissione e scadenza.
function formattaData(value?: string | null) {
  const data = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  return data ? data[3] + "/" + data[2] + "/" + data[1] : "Non disponibile";
}

// Presentazione condivisa: nessuna lettura dati, sessione o token.
export default function TesseraAssociativa(props: Props) {
  const { dati } = props;
  const annoTessera = dati.anno;
  const dataRilascio = formattaData(dati.emissione);
  return (
    <div data-stampa-tessera className="rta-tessera-page min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
      <article aria-label="Tessera associativa del socio" className="rta-tessera-document mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 border-t-4 border-t-blue-900 bg-white p-5 text-slate-900 shadow-lg sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Tessera associativa</p>
            <h1 className="mt-1 font-serif text-2xl font-black tracking-tight text-blue-950 sm:text-4xl">{associazione.denominazione}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Ente accreditato</span>
              <img src={associazione.logoRegione} alt="Regione Lazio" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-12 w-24 object-contain" />
            </div>
          </div>
          <img src={associazione.logoRta} alt="Logo Roma R.T.A." onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-20 w-16 shrink-0 object-contain sm:h-28 sm:w-24" />
        </header>

        <div className="space-y-2 py-5 text-xs leading-relaxed text-slate-700">
          <p className="font-bold text-blue-950">{associazione.denominazioneCompleta}</p>
          <p className="font-semibold">{associazione.distaccamento}</p>
          <p>{associazione.indirizzo}</p>
        </div>

        <section aria-labelledby="socio-titolo" className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-900">Socio sostenitore</p>
            <p className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-bold text-white">Tessera N&deg; {dati.numero ?? "Non disponibile"}</p>
          </div>
          <h2 id="socio-titolo" className="mt-5 break-words text-2xl font-bold uppercase leading-snug text-blue-950 sm:text-3xl">{dati.nome} {dati.cognome}</h2>
          <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-slate-600">Anno associativo</dt><dd className="mt-1 font-bold text-slate-900">{annoTessera || "Anno non disponibile"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-600">Data di emissione</dt><dd className="mt-1 font-bold text-slate-900">{dataRilascio}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-600">Scadenza</dt><dd className="mt-1 font-semibold">{formattaData(dati.scadenza)}</dd></div>
            {props.variante === "interna" && <div><dt className="text-xs font-semibold text-slate-600">Data di nascita</dt><dd className="mt-1 font-semibold">{formattaData(props.dettagliRiservati.dataNascita)}</dd></div>}
          </dl>
          {props.variante === "interna" && <div className="mt-5 border-t border-blue-200 pt-4">
            <p className="text-xs font-semibold text-slate-600">Codice fiscale</p>
            <p className="mt-1 break-all font-mono text-sm font-semibold tracking-wider text-blue-950">{props.dettagliRiservati.codiceFiscale?.toUpperCase() || "Non disponibile"}</p>
          </div>}
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
        {props.variante === "pubblica" && <p className="text-xs leading-relaxed text-slate-600">Il link è personale: chi lo riceve può leggere questa tessera. Per ricaricare riapri il collegamento completo dal messaggio originale.</p>}
        <p className="text-xs leading-relaxed text-slate-600">Nel menu di stampa scegli A4 verticale oppure Salva come PDF. Disattiva intestazioni e pie di pagina del browser.</p>
      </div>
    </div>
  );
}
