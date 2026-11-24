"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DocumentoRicevuta from "./DocumentoRicevuta";
import { supabase } from "@/app/lib/supabase";
import { causaliRicevuta, creaPdfRicevuta, type EmittenteRicevuta, type Ricevuta } from "@/app/lib/ricevute";
import { formattaImporto } from "@/app/lib/stato-prenotazione";

export default function EmissioneRicevuta({ id, emettibile, importo, metodo, dataServizio, intestatario }: {
  id: string; emettibile: boolean; importo: number; metodo: string | null; dataServizio: string; intestatario: string;
}) {
  const [ricevuta, setRicevuta] = useState<Ricevuta | null>(null);
  type Config = { emissione_attiva: boolean; serie: string; emittente: EmittenteRicevuta };
  const [config, setConfig] = useState<Config | null>(null);
  const [bozza, setBozza] = useState({ intestatario, codice_fiscale: "", indirizzo: "", causale: "",
    data_nascita: "", luogo_nascita: "", citta: "", cap: "", descrizione: "" });
  const [aperta, setAperta] = useState(false);
  const [anteprima, setAnteprima] = useState("");
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState("");
  const dettagli = { data_nascita: bozza.data_nascita || null, luogo_nascita: bozza.luogo_nascita.trim(),
    citta: bozza.citta.trim(), cap: bozza.cap.trim(), descrizione: bozza.causale === "Altro" ? bozza.descrizione.trim() : null };

  useEffect(() => {
    let attivo = true;
    Promise.all([
      supabase.from("roma_rta_ricevute").select("*").eq("prenotazione_id", id).maybeSingle(),
      supabase.rpc("roma_rta_config_ricevute").maybeSingle<Config>(),
    ]).then(([documento, impostazioni]) => {
      if (!attivo) return;
      if (documento.error || impostazioni.error) setErrore("Impossibile caricare le ricevute.");
      else {
        setRicevuta(documento.data);
        setConfig(impostazioni.data);
      }
    });
    return () => { attivo = false; };
  }, [id]);

  useEffect(() => () => { if (anteprima) URL.revokeObjectURL(anteprima); }, [anteprima]);

  async function generaAnteprima() {
    if (!config || !bozza.intestatario.trim() || !bozza.causale || (bozza.causale === "Altro" && !bozza.descrizione.trim())) return;
    setOccupato(true);
    setErrore("");
    try {
      setAnteprima(URL.createObjectURL(await creaPdfRicevuta({
        intestatario: bozza.intestatario.trim(), codice_fiscale: bozza.codice_fiscale.trim().toUpperCase(),
        indirizzo: bozza.indirizzo.trim(), causale: bozza.causale, dettagli, importo,
        serie: config.serie, emittente: config.emittente, metodo_pagamento: metodo, data_servizio: dataServizio,
      })));
    } catch {
      setErrore("Impossibile generare l’anteprima PDF.");
    } finally {
      setOccupato(false);
    }
  }

  async function emetti() {
    if (occupato || !config?.emissione_attiva || !anteprima || !emettibile) return;
    if (!window.confirm("Emettere e archiviare definitivamente la ricevuta?")) return;
    setOccupato(true);
    setErrore("");
    try {
      const emissione = await supabase.rpc("roma_rta_emetti_ricevuta", {
        p_id: id, p_intestatario: bozza.intestatario, p_cf: bozza.codice_fiscale,
        p_indirizzo: bozza.indirizzo, p_causale: bozza.causale,
        p_importo: importo, p_metodo: metodo, p_data_servizio: dataServizio, p_serie: config.serie,
        p_dettagli: dettagli, p_emittente: config.emittente,
      });
      if (emissione.error) throw emissione.error;
      const documento = await supabase.from("roma_rta_ricevute").select("*").eq("id", emissione.data).single();
      if (documento.error) throw documento.error;
      setRicevuta(documento.data);
      setAnteprima("");
    } catch {
      setErrore("Esito dell’emissione non disponibile. Ricarica la prenotazione per verificare l’archivio.");
    } finally {
      setOccupato(false);
    }
  }

  const campi = [
    ["intestatario", "Ricevuti da", 180, "text"],
    ["data_nascita", "Data di nascita", undefined, "date"],
    ["luogo_nascita", "Luogo di nascita", 120, "text"],
    ["codice_fiscale", "Codice fiscale", 24, "text"],
    ["indirizzo", "Via", 220, "text"],
    ["citta", "Città", 120, "text"],
    ["cap", "CAP", 5, "text"],
  ] as const;
  const campoClasse = "w-full rounded-lg border border-slate-300 p-2";
  const aggiorna = (campo: keyof typeof bozza, valore: string) => {
    setBozza((precedente) => ({ ...precedente, [campo]: valore }));
    setAnteprima("");
  };

  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap justify-between gap-2">
      <h2 className="font-bold text-slate-900">Ricevuta</h2>
      <Link href="/ricevute" className="text-sm font-semibold text-blue-800 underline">Archivio ricevute</Link>
    </div>
    {ricevuta ? <DocumentoRicevuta ricevuta={ricevuta} /> : emettibile && config && (aperta
      ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void generaAnteprima(); }}>
        <fieldset disabled={occupato} className="grid gap-2 sm:grid-cols-2">
          {campi.map(([campo, titolo, limite, tipo]) => <label key={campo} className="space-y-1 text-sm font-semibold">
            <span>{titolo}</span>
            <input className={campoClasse} type={tipo} value={bozza[campo]} maxLength={limite}
              inputMode={campo === "cap" ? "numeric" : undefined} pattern={campo === "cap" ? "[0-9]{5}" : undefined}
              required={campo === "intestatario"} onChange={(event) => aggiorna(campo, event.target.value)} />
          </label>)}
          <label className="space-y-1 text-sm font-semibold">Causale
            <select className={campoClasse} value={bozza.causale} required onChange={(event) => aggiorna("causale", event.target.value)}>
              <option value="">Seleziona la causale</option>
              {causaliRicevuta.map((causale) => <option key={causale}>{causale}</option>)}
            </select>
          </label>
          {bozza.causale === "Altro" && <label className="space-y-1 text-sm font-semibold sm:col-span-2">Descrizione
            <textarea className={campoClasse} value={bozza.descrizione} maxLength={350} required
              onChange={(event) => aggiorna("descrizione", event.target.value)} />
          </label>}
        </fieldset>
        <p className="text-sm">Importo incassato {formattaImporto(importo)}{metodo && ` · ${metodo}`}{config.serie && ` · Serie ${config.serie}`}</p>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={occupato || !bozza.intestatario.trim() || !bozza.causale || (bozza.causale === "Altro" && !bozza.descrizione.trim())}
            className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Genera anteprima PDF</button>
          {anteprima && <a href={anteprima} target="_blank" rel="noopener noreferrer" className="py-2 text-sm font-semibold text-blue-800 underline">Apri anteprima PDF</a>}
          {config.emissione_attiva && <button type="button" disabled={occupato || !anteprima} onClick={emetti}
            className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Emetti definitivamente</button>}
        </div>
        {!config.emissione_attiva && <p className="text-sm text-slate-600">Emissione definitiva sospesa in attesa della conferma fiscale.</p>}
      </form>
      : <button type="button" onClick={() => setAperta(true)} className="text-sm font-semibold text-blue-800 underline">Prepara ricevuta</button>)}
    {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
  </section>;
}
