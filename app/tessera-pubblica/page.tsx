"use client";
import { useEffect, useRef, useState } from "react";
import { associazione } from "@/app/lib/associazione";
import TesseraAssociativa, { type DatiTessera } from "@/components/TesseraAssociativa";
import { tokenPubblicoValido } from "@/app/lib/link-tessera";
type Tessera = DatiTessera;
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
  if (!loading && !errore && tessera) return <TesseraAssociativa variante="pubblica" dati={{
    nome: tessera.nome, cognome: tessera.cognome, numero: tessera.numero, anno: tessera.anno,
    emissione: tessera.emissione, scadenza: tessera.scadenza,
  }} />;
  return <div className="min-h-screen bg-slate-100 p-5 sm:p-10">
    <section className="mx-auto max-w-xl rounded-2xl border-t-4 border-blue-900 bg-white p-6 shadow">
      <h1 className="text-2xl font-bold text-blue-950">{associazione.denominazione}</h1>
      {loading ? <p role="status" className="mt-6">Verifica collegamento...</p> : <div role="alert" className="mt-6">
        <p>{errore || "Collegamento non disponibile o scaduto."}</p>
        <button className="mt-4 min-h-11 rounded bg-blue-900 px-4 py-2 text-white" onClick={() => setTentativo(v => v + 1)}>Riprova</button>
        <p className="mt-4">Centrale: {associazione.telefono}</p>
      </div>}
    </section>
  </div>;
}
