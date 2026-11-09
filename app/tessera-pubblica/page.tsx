"use client";
import { useEffect, useRef, useState } from "react";
import { associazione } from "@/app/lib/associazione";
import { tokenPubblicoValido } from "@/app/lib/link-tessera";
type Tessera = { nome: string; cognome: string; numero: string; anno: number; emissione: string | null; scadenza: string };
export default function TesseraPubblica() {
  const token = useRef<string | null>(null);
  const [tessera, setTessera] = useState<Tessera | null>(null);
  const [errore, setErrore] = useState("");
  const [loading, setLoading] = useState(true);
  const [tentativo, setTentativo] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (token.current === null) {
      token.current = window.location.hash.slice(1);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setLoading(true); setTessera(null); setErrore("");
    void (async () => {
      try {
        if (!tokenPubblicoValido(token.current)) throw new Error("Collegamento non disponibile o scaduto. Contatta la centrale.");
        const response = await fetch("/api/tessera-pubblica", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current }), cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.errore || "Collegamento non disponibile o scaduto.");
        if (!controller.signal.aborted) setTessera(data.tessera);
      } catch (error) {
        if (!controller.signal.aborted) setErrore(error instanceof Error ? error.message : "Servizio non disponibile.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [tentativo]);
  const dataIt = (value: string | null) => value ? value.slice(0, 10).split("-").reverse().join("/") : "Non disponibile";
  return <div className="min-h-screen bg-slate-100 p-5 sm:p-10">
    <article className="mx-auto max-w-xl rounded-2xl border-t-4 border-blue-900 bg-white p-6 shadow">
      <h1 className="text-2xl font-bold text-blue-950">{associazione.denominazione}</h1>
      <p className="mt-2 text-sm">Tessera associativa - Socio sostenitore</p>
      {loading ? <p role="status" className="mt-6">Verifica collegamento...</p> : errore ? <div role="alert" className="mt-6"><p>{errore}</p><button className="mt-4 rounded bg-blue-900 px-4 py-2 text-white" onClick={() => setTentativo(v => v + 1)}>Riprova</button><p className="mt-4">Centrale: {associazione.telefono}</p></div> : tessera && <>
        <h2 className="mt-6 text-2xl font-bold">{tessera.nome} {tessera.cognome}</h2>
        <dl className="mt-5 space-y-3"><div><dt>Numero tessera</dt><dd className="font-bold">{tessera.numero}/{tessera.anno}</dd></div><div><dt>Emissione</dt><dd>{dataIt(tessera.emissione)}</dd></div><div><dt>Scadenza associativa</dt><dd>{dataIt(tessera.scadenza)}</dd></div></dl>
        <p className="mt-6 text-sm">{associazione.telefono} | {associazione.email}</p>
        <button onClick={() => window.print()} className="mt-6 rounded bg-blue-900 px-4 py-3 font-bold text-white print:hidden">Stampa / Salva PDF</button>
        <p className="mt-3 text-xs print:hidden">Il link è personale: chi lo riceve può leggere questa tessera. Per ricaricare la pagina riapri il collegamento originale.</p>
      </>}
    </article>
  </div>;
}
