"use client";

import { useEffect, useState } from "react";
import { creaPdfRicevuta, identificativoRicevuta, type Ricevuta } from "@/app/lib/ricevute";

export default function DocumentoRicevuta({ ricevuta }: { ricevuta: Ricevuta }) {
  const [documento, setDocumento] = useState<{ id: string; file: File; url: string }>();
  const [errore, setErrore] = useState("");
  const [tentativo, setTentativo] = useState(0);
  const corrente = documento?.id === ricevuta.id ? documento : undefined;

  useEffect(() => {
    let attivo = true;
    let url: string | undefined;
    creaPdfRicevuta(ricevuta, ricevuta).then((file) => {
      if (!attivo) return;
      url = URL.createObjectURL(file);
      setDocumento({ id: ricevuta.id, file, url });
    }).catch(() => {
      if (attivo) setErrore("Impossibile preparare il PDF.");
    });
    return () => {
      attivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ricevuta, tentativo]);

  async function condividi() {
    if (!corrente) return;
    try {
      await navigator.share({ files: [corrente.file], title: "Ricevuta ROMA R.T.A." });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrore("Condivisione non riuscita. Scarica il PDF e allegalo in WhatsApp.");
      }
    }
  }

  return <div className="space-y-2">
    <p className="font-semibold">Ricevuta {identificativoRicevuta(ricevuta)}</p>
    {corrente ? <div className="flex flex-wrap gap-3 text-sm font-semibold text-blue-800">
      <a className="underline" href={corrente.url} download={corrente.file.name}>Scarica PDF</a>
      <a className="underline" href={corrente.url} target="_blank" rel="noopener noreferrer">Apri per ristampare</a>
      {typeof navigator !== "undefined" && navigator.canShare?.({ files: [corrente.file] })
        ? <button className="underline" type="button" onClick={condividi}>Condividi PDF via WhatsApp</button>
        : <span className="font-normal text-slate-600">Per inviarlo su WhatsApp, scarica e allega il PDF.</span>}
    </div> : errore ? <button type="button" className="underline" onClick={() => {
      setErrore("");
      setTentativo((valore) => valore + 1);
    }}>Riprova</button> : <p role="status">Preparazione PDF…</p>}
    {errore && <p role="alert">{errore}</p>}
  </div>;
}
