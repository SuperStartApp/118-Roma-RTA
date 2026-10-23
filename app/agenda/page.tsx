"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ArrowRight, 
  ChevronRight, 
  CheckCircle2, 
  Loader2
} from "lucide-react";

interface CorsaOggi {
  id: string;
  ora_appuntamento: string;
  ora_inizio_effettiva: string | null;
  ora_fine_effettiva: string | null;
  pazienti: { nome: string; cognome: string } | null;
  partenza_citta: string;
  arrivo_citta: string;
}

export default function AgendaGiornaliera() {
  const [corse, setCorse] = useState<CorsaOggi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataOggiTesto, setDataOggiTesto] = useState<string>("");

  useEffect(() => {
    // 1. Calcolo sicuro della data solo sul client (evita l'errore di Next.js)
    const oggi = new Date();
    
    setDataOggiTesto(
      oggi.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );

    const year = oggi.getFullYear();
    const month = String(oggi.getMonth() + 1).padStart(2, "0");
    const day = String(oggi.getDate()).padStart(2, "0");
    const dataIso = `${year}-${month}-${day}`;

    fetchCorseOggi(dataIso);
  }, []);

  async function fetchCorseOggi(dataOggiIso: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prenotazioni")
        .select(`*, pazienti(nome, cognome)`)
        .eq("data_appuntamento", dataOggiIso)
        .order("ora_appuntamento", { ascending: true });

      if (error) throw error;
      setCorse(data || []);
    } catch (error: any) {
      console.error("Errore agenda:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24 space-y-3">
        <Loader2 className="animate-spin text-blue-600" size={34} />
        <span className="text-sm font-semibold text-slate-600">Sincronizzazione turni odierni...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER AGENDA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <Calendar size={14} /> Turno Operativo
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 capitalize">
              {dataOggiTesto || "Oggi"}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 shadow-sm">
              <span className="text-blue-600 font-extrabold">{corse.length}</span> {corse.length === 1 ? "servizio" : "servizi"} in programma
            </span>
          </div>
        </div>

        {/* LISTA DEI SERVIZI DI OGGI */}
        {corse.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl shadow-sm text-center border border-slate-200 space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              Nessun servizio in programma per oggi
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Non risultano corse assegnate per la data odierna. Puoi registrare un nuovo servizio dalla sezione dedicata.
            </p>
            <div className="pt-2">
              <Link
                href="/prenotazione"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                + Registra Nuova Corsa
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {corse.map((corsa) => {
              const isCompletata = Boolean(corsa.ora_fine_effettiva);
              const isInCorso = Boolean(corsa.ora_inizio_effettiva && !corsa.ora_fine_effettiva);
              const statoTesto = isCompletata ? "Completata" : isInCorso ? "In Corso" : "In Attesa";

              const badgeStyle = isCompletata
                ? "bg-slate-100 text-slate-700 border-slate-200"
                : isInCorso
                ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                : "bg-blue-50 text-blue-700 border-blue-200";

              return (
                <div
                  key={corsa.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition overflow-hidden"
                >
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Blocco Ora e Dettagli */}
                    <div className="flex items-start gap-4">
                      {/* Ora Appuntamento */}
                      <div className="flex flex-col items-center justify-center bg-slate-100 border border-slate-200 rounded-lg w-16 h-14 shrink-0 text-slate-900">
                        <Clock size={13} className="text-slate-400 mb-0.5" />
                        <span className="text-base font-bold leading-tight">
                          {corsa.ora_appuntamento || "--:--"}
                        </span>
                      </div>

                      {/* Info Paziente e Destinazione */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-bold text-slate-900 text-base">
                            {corsa.pazienti
                              ? `${corsa.pazienti.nome} ${corsa.pazienti.cognome}`
                              : "Paziente non specificato"}
                          </h2>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${badgeStyle}`}>
                            {statoTesto}
                          </span>
                        </div>

                        {/* Tratta */}
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span>{corsa.partenza_citta || "Partenza non indicata"}</span>
                          <ArrowRight size={12} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700">
                            {corsa.arrivo_citta || "Destinazione non indicata"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottone Scheda Completa */}
                    <div className="flex justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <Link
                        href={`/prenotazioni/${corsa.id}`}
                        className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
                      >
                        Visualizza Scheda
                        <ChevronRight size={14} />
                      </Link>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}