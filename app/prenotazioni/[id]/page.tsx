"use client";

import React, { useEffect, useState, Suspense } from "react";
import { supabase } from "@/app/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Activity, 
  CreditCard, 
  Clock, 
  Timer, 
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight
} from "lucide-react";

function CorsaDetailContent() {
  const params = useParams();
  const router = useRouter();
  const [corsa, setCorsa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDettagli() {
      if (!params || !params.id) return;
      try {
        const { data, error } = await supabase
          .from("prenotazioni")
          .select(`*, pazienti(*), autisti(nome, cognome)`)
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setCorsa(data);
      } catch (error: any) {
        console.error("Errore caricamento dettagli:", error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDettagli();
  }, [params]);

  const calcolaDurata = () => {
    if (!corsa?.ora_inizio_effettiva || !corsa?.ora_fine_effettiva) return null;
    const inizio = new Date(corsa.ora_inizio_effettiva);
    const fine = new Date(corsa.ora_fine_effettiva);
    const diffMs = fine.getTime() - inizio.getTime();
    if (diffMs < 0) return "--";
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h ${diffMins}m`;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24 space-y-3">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="text-sm font-semibold text-slate-600">Caricamento scheda di viaggio...</p>
      </div>
    );
  }

  if (!corsa) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-3">
        <AlertCircle className="mx-auto text-red-500" size={32} />
        <h2 className="text-lg font-bold text-slate-800">Servizio non trovato</h2>
        <p className="text-sm text-slate-500">La prenotazione richiesta non esiste o è stata archiviata.</p>
        <button 
          onClick={() => router.push('/prenotazioni')}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
        >
          <ArrowLeft size={14} /> Torna all'archivio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      
      {/* TESTATA SCHEDA MISSIONE */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="text-[11px] font-mono tracking-wider uppercase text-blue-400">
              Scheda Missione #{corsa.id ? corsa.id.slice(0, 8).toUpperCase() : "N/D"}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mt-0.5">
              {corsa.pazienti ? `${corsa.pazienti.nome} ${corsa.pazienti.cognome}` : "Paziente non assegnato"}
            </h1>
          </div>

          {/* Badge Stato Pagamento */}
          <div className="self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                corsa.pagato
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              <CreditCard size={13} />
              {corsa.pagato ? "Pagamento Confermato" : "Da Saldo / Insoluto"}
            </span>
          </div>
        </div>

        {/* METADATI DI PRENOTAZIONE */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 text-xs">
          <div>
            <span className="text-slate-400 block">Data Servizio</span>
            <span className="font-semibold text-slate-200">
              {corsa.data_appuntamento ? new Date(corsa.data_appuntamento).toLocaleDateString("it-IT") : "--"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Orario Convocazione</span>
            <span className="font-semibold text-slate-200">
              {corsa.ora_appuntamento || "--:--"}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-400 block">Equipaggio / Autista</span>
            <span className="font-semibold text-slate-200">
              {corsa.autisti ? `${corsa.autisti.nome} ${corsa.autisti.cognome}` : "Non ancora assegnato"}
            </span>
          </div>
        </div>
      </div>

      {/* MONITORAGGIO MISSIONE & TEMPI EFFETTIVI */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Timer size={18} className="text-blue-600" />
          <span>Monitoraggio Esecuzione Corsa</span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 text-center">
            <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider">Inizio Corsa</p>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
              {corsa.ora_inizio_effettiva
                ? new Date(corsa.ora_inizio_effettiva).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </p>
          </div>

          <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 text-center">
            <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider">Fine Corsa</p>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
              {corsa.ora_fine_effettiva
                ? new Date(corsa.ora_fine_effettiva).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-3 sm:p-4 rounded-xl text-center">
            <p className="text-[10px] sm:text-xs text-blue-600 uppercase font-bold tracking-wider">Tempo Totale</p>
            <p className="text-base sm:text-xl font-black text-blue-900 mt-0.5">
              {calcolaDurata() || "In corso"}
            </p>
          </div>
        </div>
      </div>

      {/* TRATTA: PARTENZA E ARRIVO */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <MapPin size={18} className="text-blue-600" />
          <span>Tratta e Destinazione</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Partenza */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span> Partenza / Ritiro
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {corsa.partenza_via ? `${corsa.partenza_via}, ${corsa.partenza_civico || ""}` : "Indirizzo non inserito"}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {corsa.partenza_citta || "Città non specificata"}
            </p>
          </div>

          {/* Arrivo */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Arrivo / Struttura
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {corsa.arrivo_via ? `${corsa.arrivo_via}, ${corsa.arrivo_civico || ""}` : "Indirizzo non inserito"}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {corsa.arrivo_citta || "Città non specificata"}
            </p>
          </div>
        </div>
      </div>

      {/* DETTAGLI ANAGRAFICI E CLINICI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Anagrafica */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2">
            <User size={16} className="text-slate-500" />
            <span>Dati Anagrafici</span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Codice Fiscale</span>
              <span className="font-mono font-bold text-slate-800 text-sm break-all">
                {corsa.pazienti?.codice_fiscale || "Non registrato"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Contatto Telefonico</span>
              <span className="font-semibold text-slate-800 text-sm">
                {corsa.pazienti?.telefono || "Nessun recapito telefonico"}
              </span>
            </div>
          </div>
        </div>

        {/* Profilo Clinico */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2">
            <Activity size={16} className="text-red-500" />
            <span>Condizioni / Patologia</span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Segnalazioni di Trasporto</span>
              <p className="text-slate-800 font-medium text-sm mt-0.5">
                {corsa.patologia || "Nessuna patologia o annotazione medica segnalata."}
              </p>
            </div>
            {corsa.costo && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Importo Convenuto</span>
                <span className="font-extrabold text-slate-900 text-base">{corsa.costo} €</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

export default function DettaglioCorsaPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-4">
        
        {/* Pulsante Torna Indietro */}
        <Link 
          href="/prenotazioni" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition mb-2"
        >
          <ArrowLeft size={16} /> Torna all'elenco corse
        </Link>

        <Suspense fallback={
          <div className="flex justify-center items-center py-20 text-slate-400 space-y-2">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        }>
          <CorsaDetailContent />
        </Suspense>

      </div>
    </div>
  );
}