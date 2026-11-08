"use client";

import React, { useEffect, useState, Suspense } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import { statoPrenotazione, formattaImporto } from "@/app/lib/stato-prenotazione";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Activity, 
  CreditCard, 
  Timer, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Navigation, 
  Phone, 
  MessageCircle, 
  ShieldCheck, 
  Building2, 
  Wind, 
  Stethoscope, 
  ArrowUpCircle
} from "lucide-react";

function CorsaDetailContent() {
  const params = useParams();
  const router = useRouter();
  const [corsa, setCorsa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    async function fetchDettagli() {
      if (!params || !params.id) return;
      setLoading(true);
      setErroreCaricamento(null);
      try {
        const { data, error } = await supabase
          .from("prenotazioni")
          .select(`*, pazienti(*), autisti(nome, cognome, telefono)`)
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setCorsa(data);
      } catch (error: any) {
        console.error("Errore caricamento dettagli:", error.message);
        setErroreCaricamento("Impossibile leggere la scheda della corsa. Verifica il collegamento e riprova.");
      } finally {
        setLoading(false);
      }
    }
    fetchDettagli();
  }, [params, tentativo]);

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

  // APRI NAVIGATORE IN 1 TAP (Google Maps)
  const apriNavigatore = (via?: string, civico?: string, citta?: string) => {
    if (!via) return;
    const query = encodeURIComponent(`${via} ${civico || ""}, ${citta || ""}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  // CONDIVISIONE TESSERA / DETTAGLI VIA WHATSAPP
  const inviaWhatsApp = () => {
    if (!corsa?.pazienti?.telefono) {
      alert("Nessun numero di telefono registrato per questo paziente.");
      return;
    }
    const cleanPhone = corsa.pazienti.telefono.replace(/\D/g, "");
    const numeroWhatsapp = cleanPhone.startsWith("39") ? cleanPhone : `39${cleanPhone}`;

    const haTessera = corsa.pazienti.numero_tessera;
    const testoTessera = haTessera
      ? `\n💳 *Tessera Socio Sostenitore:* N° ${corsa.pazienti.numero_tessera}/${corsa.pazienti.anno_tessera || new Date().getFullYear()}\n`
      : "";

    const messaggio = 
      `🚑 *Riepilogo Servizio Trasporto Sanitario*\n\n` +
      `Gentile *${corsa.pazienti.nome} ${corsa.pazienti.cognome}*,${testoTessera}\n` +
      `Le confermiamo il servizio per il giorno *${corsa.data_appuntamento ? new Date(corsa.data_appuntamento).toLocaleDateString("it-IT") : ""}* alle ore *${corsa.ora_appuntamento || ""}*.\n\n` +
      `📍 *Ritiro:* ${corsa.partenza_via || ""} ${corsa.partenza_civico || ""}, ${corsa.partenza_citta || ""}\n` +
      `🏥 *Destinazione:* ${corsa.arrivo_via || ""} ${corsa.arrivo_civico || ""}, ${corsa.arrivo_citta || ""}\n` +
      (corsa.costo ? `💶 *Importo concordato:* ${corsa.costo} €\n` : "") +
      `\nGrazie per la fiducia! Per qualsiasi informazione restiamo a completa disposizione.`;

    window.open(`https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(messaggio)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24 space-y-3">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="text-sm font-semibold text-slate-600">Caricamento scheda di viaggio...</p>
      </div>
    );
  }

  if (erroreCaricamento) return <ErroreCaricamento messaggio={erroreCaricamento} onRiprova={() => setTentativo((n) => n + 1)} />;

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
      
      {/* TESTATA OPERATIVA */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tracking-wider uppercase text-blue-400">
                Missione #{corsa.id ? corsa.id.slice(0, 8).toUpperCase() : "N/D"}
              </span>
              {corsa.pazienti?.numero_tessera && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <ShieldCheck size={11} /> SOCIO SOSTENITORE N° {corsa.pazienti.numero_tessera}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mt-1">
              {corsa.pazienti ? `${corsa.pazienti.nome} ${corsa.pazienti.cognome}` : "Paziente non assegnato"}
            </h1>
          </div>

          {/* Badge Stato Pagamento */}
          <div className="self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                corsa.pagato
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              <CreditCard size={13} />
              {statoPrenotazione(corsa)}
            </span>
          </div>
        </div>

        {corsa.annullata_il && (
          <div className="mt-3 rounded-lg border border-slate-600 bg-slate-800 p-3 text-xs text-slate-100">
            <p>Annullata il {new Date(corsa.annullata_il).toLocaleString("it-IT")}. Costo originale: {formattaImporto(corsa.costo)}.</p>
            {corsa.pagato && <p>Rimborso integrale {corsa.rimborso_effettuato_il ? `effettuato il ${new Date(corsa.rimborso_effettuato_il).toLocaleString("it-IT")}` : "da effettuare"}: {formattaImporto(corsa.costo)}. Incasso originale conservato.</p>}
          </div>
        )}

        {/* METADATI MISSIONE */}
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
            <span className="font-semibold text-blue-300">
              {corsa.autisti ? `${corsa.autisti.nome} ${corsa.autisti.cognome}` : "Non ancora assegnato"}
            </span>
          </div>
        </div>
      </div>

      {/* AZIONI RAPIDE OPERATIVE PER AUTISTA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {corsa.pazienti?.telefono && (
          <a
            href={`tel:${corsa.pazienti.telefono}`}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow transition"
          >
            <Phone size={18} /> Chiama Paziente ({corsa.pazienti.telefono})
          </a>
        )}
        <button
          onClick={inviaWhatsApp}
          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition"
        >
          <MessageCircle size={18} /> Invia Dettagli & Tessera via WhatsApp
        </button>
      </div>

      {/* DETTAGLI TRATTA CON NAVIGATORE 1-TAP */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <MapPin size={18} className="text-blue-600" />
          <span>Itinerario e Logistica Piani</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Partenza */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span> Partenza / Ritiro
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {corsa.partenza_piano ? `Piano ${corsa.partenza_piano}` : "P. Terra"} {corsa.partenza_ascensore ? "• Con Ascensore" : "• Senza Ascensore"}
                </span>
              </div>
              <p className="text-base font-bold text-slate-900 pt-2">
                {corsa.partenza_via ? `${corsa.partenza_via}, ${corsa.partenza_civico || ""}` : "Indirizzo non inserito"}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {corsa.partenza_citta || "Città non specificata"}
              </p>
              {corsa.partenza_dettagli_ospedale && (
                <p className="text-xs font-medium text-amber-700 bg-amber-50 p-2 rounded-lg mt-2">
                  Dettagli: {corsa.partenza_dettagli_ospedale}
                </p>
              )}
            </div>

            <button
              onClick={() => apriNavigatore(corsa.partenza_via, corsa.partenza_civico, corsa.partenza_citta)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
            >
              <Navigation size={14} /> Avvia Navigatore Ritiro
            </button>
          </div>

          {/* Destinazione */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Arrivo / Destinazione
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {corsa.arrivo_piano ? `Piano ${corsa.arrivo_piano}` : "P. Terra"} {corsa.arrivo_ascensore ? "• Con Ascensore" : "• Senza Ascensore"}
                </span>
              </div>
              <p className="text-base font-bold text-slate-900 pt-2">
                {corsa.arrivo_via ? `${corsa.arrivo_via}, ${corsa.arrivo_civico || ""}` : "Indirizzo non inserito"}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {corsa.arrivo_citta || "Città non specificata"}
              </p>
              {corsa.arrivo_dettagli_ospedale && (
                <p className="text-xs font-medium text-amber-700 bg-amber-50 p-2 rounded-lg mt-2">
                  Dettagli: {corsa.arrivo_dettagli_ospedale}
                </p>
              )}
            </div>

            <button
              onClick={() => apriNavigatore(corsa.arrivo_via, corsa.arrivo_civico, corsa.arrivo_citta)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
            >
              <Navigation size={14} /> Avvia Navigatore Destinazione
            </button>
          </div>
        </div>
      </div>

      {/* DOTAZIONI SPECIALI & PROFILO CLINICO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Clinico & Note */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2">
            <Activity size={16} className="text-red-500" />
            <span>Note Sanitarie & Trasporto</span>
          </div>
          <div className="space-y-3 text-xs">
            {/* Badge Sanitari */}
            <div className="flex flex-wrap gap-2">
              {corsa.serve_ossigeno && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                  <Wind size={13} /> Serve Ossigeno
                </span>
              )}
              {corsa.serve_medico && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                  <Stethoscope size={13} /> Personale Medico a Bordo
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Patologia Paziente</span>
              <p className="text-slate-800 font-semibold text-sm mt-0.5">
                {corsa.pazienti?.patologia || "Nessuna patologia inserita"}
              </p>
            </div>

            {corsa.note && (
              <div>
                <span className="text-slate-400 block font-medium">Note Operative</span>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs mt-0.5">
                  {corsa.note}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tempi & Costi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2">
            <Timer size={16} className="text-blue-600" />
            <span>Riepilogo Tariffa ed Esecuzione</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Durata Effettiva</span>
              <p className="text-base font-bold text-slate-800 mt-0.5">{calcolaDurata() || "In attesa"}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Importo</span>
              <p className="text-base font-extrabold text-blue-900 mt-0.5">{formattaImporto(corsa.costo)}</p>
            </div>
          </div>

          <div className="text-xs text-slate-500 pt-1">
            <span>Metodo Concordato: </span>
            <span className="font-semibold text-slate-800">{corsa.metodo_pagamento || "Non specificato"}</span>
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
