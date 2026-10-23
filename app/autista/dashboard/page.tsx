"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Play, 
  CheckCircle2, 
  LogOut, 
  MapPin, 
  Clock, 
  AlertCircle, 
  Navigation, 
  Loader2
} from "lucide-react";

export default function AutistaDashboard() {
  const [corse, setCorse] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [nomeAutista, setNomeAutista] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const autistaId = localStorage.getItem("autista_id");
    const nome = localStorage.getItem("autista_nome");

    if (!autistaId) {
      router.push("/autista");
      return;
    }

    setNomeAutista(nome || "Operatore");
    fetchMieCorse(autistaId);
  }, [router]);

  async function fetchMieCorse(id: string) {
    try {
      setLoading(true);
      // Ripristinata la selezione sicura compatibile con la tua struttura Supabase
      const { data, error: dbError } = await supabase
        .from("prenotazioni")
        .select(`*, pazienti(nome, cognome)`)
        .eq("autista_id", id)
        .order("data_appuntamento", { ascending: true })
        .order("ora_appuntamento", { ascending: true });

      if (dbError) throw dbError;
      setCorse(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Errore fetch corse autista:", err);
      setError(err?.message || "Errore nel caricamento delle corse assegnate.");
    } finally {
      setLoading(false);
    }
  }

  async function registraOra(id: string, tipo: "inizio" | "fine") {
    setActionLoading(id);
    const oraAttuale = new Date().toISOString();
    const colonna = tipo === "inizio" ? "ora_inizio_effettiva" : "ora_fine_effettiva";

    try {
      const { error: dbError } = await supabase
        .from("prenotazioni")
        .update({ [colonna]: oraAttuale })
        .eq("id", id);

      if (dbError) throw dbError;

      const autistaId = localStorage.getItem("autista_id")!;
      await fetchMieCorse(autistaId);
    } catch (err: any) {
      alert("Errore registrazione: " + (err?.message || "Riprova tra poco"));
    } finally {
      setActionLoading(null);
    }
  }

  function logout() {
    if (confirm("Sei sicuro di voler effettuare il logout dal turno?")) {
      localStorage.clear();
      router.push("/autista");
    }
  }

  const apriNavigatore = (via?: string, citta?: string) => {
    if (!citta && !via) return;
    const query = encodeURIComponent(`${via || ""} ${citta || ""}`.trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-900 text-white space-y-3">
        <Loader2 className="animate-spin text-blue-400" size={38} />
        <p className="text-sm font-semibold tracking-wide text-slate-300">Caricamento foglio servizio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center space-y-4">
        <AlertCircle size={44} className="text-red-500" />
        <div>
          <p className="text-slate-800 font-bold text-base">Impossibile caricare le corse</p>
          <p className="text-xs text-rose-600 font-mono mt-1 max-w-md mx-auto">{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const id = localStorage.getItem("autista_id");
              if (id) fetchMieCorse(id);
              else router.push("/autista");
            }}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-800 transition"
          >
            Ricarica Dati
          </button>
          <button
            onClick={logout}
            className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-300 transition"
          >
            Rifai Login PIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      
      {/* TESTATA OPERATIVA DI BORDO */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg text-white shadow-sm">
              {nomeAutista.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">In Servizio</span>
              </div>
              <h1 className="text-base font-bold text-white leading-tight">
                {nomeAutista}
              </h1>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition"
            title="Fine Turno"
          >
            <LogOut size={15} />
            <span>Esci</span>
          </button>
        </div>
      </header>

      {/* CONTENUTO DASHBOARD */}
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        
        {/* TITOLO SEZIONE */}
        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <Clock size={18} className="text-blue-600" />
            <span>Missioni Assegnate</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
            {corse.length} {corse.length === 1 ? "corsa" : "corse"}
          </span>
        </div>

        {/* LISTA DELLE MISSIONI */}
        <div className="space-y-4">
          {corse.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center text-slate-500 border border-slate-200 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-bold text-slate-800">Nessuna missione in coda</p>
              <p className="text-xs text-slate-400">Tutti i trasporti assegnati sono stati completati.</p>
            </div>
          ) : (
            corse.map((corsa) => {
              const haIniziato = Boolean(corsa.ora_inizio_effettiva);
              const haFinito = Boolean(corsa.ora_fine_effettiva);
              const isInCorso = haIniziato && !haFinito;
              const isWorking = actionLoading === corsa.id;

              return (
                <div
                  key={corsa.id}
                  className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${
                    isInCorso 
                      ? "border-amber-400 ring-2 ring-amber-400/20" 
                      : haFinito 
                      ? "border-slate-200 opacity-80" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  
                  {/* INTESTAZIONE SCHEDA */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900 tracking-tight">
                          {corsa.ora_appuntamento || "--:--"}
                        </span>
                        {isInCorso && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping"></span>
                            In Corso
                          </span>
                        )}
                        {haFinito && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                            Chiusa
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-800 text-base mt-0.5">
                        {corsa.pazienti ? `${corsa.pazienti.nome} ${corsa.pazienti.cognome}` : "Paziente non specificato"}
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-500 font-medium">
                      {corsa.data_appuntamento ? new Date(corsa.data_appuntamento).toLocaleDateString("it-IT") : ""}
                    </div>
                  </div>

                  {/* ITINERARIO E NAVIGAZIONE GOOGLE MAPS */}
                  <div className="space-y-2.5 text-xs text-slate-700">
                    {/* Partenza */}
                    <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start gap-2">
                        <MapPin size={15} className="text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Ritiro</span>
                          <span className="font-semibold text-slate-900">
                            {corsa.partenza_via ? `${corsa.partenza_via}, ${corsa.partenza_civico || ""}` : ""}
                          </span>
                          <span className="text-slate-600 block">{corsa.partenza_citta}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => apriNavigatore(corsa.partenza_via, corsa.partenza_citta)}
                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0 transition"
                        title="Naviga verso la partenza"
                      >
                        <Navigation size={16} />
                      </button>
                    </div>

                    {/* Arrivo */}
                    <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start gap-2">
                        <MapPin size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Destinazione</span>
                          <span className="font-semibold text-slate-900">
                            {corsa.arrivo_via ? `${corsa.arrivo_via}, ${corsa.arrivo_civico || ""}` : ""}
                          </span>
                          <span className="text-slate-600 block">{corsa.arrivo_citta}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => apriNavigatore(corsa.arrivo_via, corsa.arrivo_citta)}
                        className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg shrink-0 transition"
                        title="Naviga verso la destinazione"
                      >
                        <Navigation size={16} />
                      </button>
                    </div>
                  </div>

                  {/* PULSANTI OPERATIVI */}
                  <div className="pt-3 border-t border-slate-100">
                    {!haIniziato ? (
                      <button
                        disabled={isWorking}
                        onClick={() => registraOra(corsa.id, "inizio")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] disabled:opacity-50"
                      >
                        {isWorking ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <Play size={18} fill="currentColor" />
                            <span>AVVIA MISSIONE</span>
                          </>
                        )}
                      </button>
                    ) : !haFinito ? (
                      <button
                        disabled={isWorking}
                        onClick={() => registraOra(corsa.id, "fine")}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] disabled:opacity-50 animate-pulse"
                      >
                        {isWorking ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            <span>TERMINA MISSIONE</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-200">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        <span>Missione registrata e completata</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </main>
    </div>
  );
}