"use client";

import { useEffect, useState } from "react";
import { tokenPubblicoValido } from "@/app/lib/link-tessera";

export default function RicevutaCondivisa() {
  const [pdf, setPdf] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState("");
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf); }, [pdf]);

  async function caricaPdf() {
    const token = window.location.hash.slice(1);
    if (!tokenPubblicoValido(token)) {
      setErrore("Collegamento non disponibile, scaduto o revocato.");
      return;
    }
    setCaricamento(true);
    setErrore("");
    try {
      const risposta = await fetch("/api/ricevuta-condivisa", {
        method: "POST", cache: "no-store", credentials: "omit",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      if (risposta.status === 404) {
        setErrore("Collegamento non disponibile, scaduto o revocato.");
      } else if (risposta.ok && risposta.headers.get("Content-Type") === "application/pdf") {
        setPdf(URL.createObjectURL(await risposta.blob()));
      } else {
        setErrore("PDF temporaneamente non disponibile. Riprova.");
      }
    } catch {
      setErrore("PDF temporaneamente non disponibile. Riprova.");
    } finally {
      setCaricamento(false);
    }
  }

  return <main className="mx-auto mt-10 w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
    <h1 className="text-lg font-bold text-slate-900">Ricevuta ROMA R.T.A.</h1>
    {pdf ? <div className="flex flex-wrap gap-4 text-sm font-semibold text-blue-800">
      <a href={pdf} target="_blank" rel="noopener noreferrer" className="underline">Visualizza PDF</a>
      <a href={pdf} download="Ricevuta-ROMA-RTA.pdf" className="underline">Scarica PDF</a>
    </div> : <button type="button" onClick={caricaPdf} disabled={caricamento}
      className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {caricamento ? "Caricamento…" : "Apri ricevuta"}
    </button>}
    {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
  </main>;
}
