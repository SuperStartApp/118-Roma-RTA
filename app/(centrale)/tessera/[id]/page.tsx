"use client";

import React, { useEffect, useState, Suspense } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import TesseraAssociativa from "@/components/TesseraAssociativa";
import { idPazienteValido } from "@/app/lib/id-paziente";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

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
      if (!idPazienteValido(params.id)) {
        setPaziente(null);
        setErroreCaricamento("Collegamento interno non valido: occorre l’UUID del paziente. Riapri la tessera dalla scheda paziente aggiornata.");
        setLoading(false);
        return;
      }
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

  return <TesseraAssociativa variante="interna"
    dati={{ nome: paziente.nome, cognome: paziente.cognome, numero: paziente.numero_tessera ?? null,
      anno: paziente.anno_tessera ?? null, emissione: paziente.data_tesseramento ?? null,
      scadenza: paziente.anno_tessera ? paziente.anno_tessera + "-12-31" : null }}
    dettagliRiservati={{ dataNascita: paziente.data_nascita, codiceFiscale: paziente.codice_fiscale }} />;

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
