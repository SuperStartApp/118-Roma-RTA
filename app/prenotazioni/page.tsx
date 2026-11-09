"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import { annullaPrenotazione, registraRimborso, cambiaPagamento } from "@/app/lib/operazioni-prenotazioni";
import { statoPrenotazione, rimborsoPendente, formattaImporto, costoValido, type DatiEconomiciPrenotazione } from "@/app/lib/stato-prenotazione";
import Link from "next/link";
import AvvisaAutista from "@/components/AvvisaAutista";
import { 
  Search, 
  Calendar, 
  User, 
  Eye, 
  Clock, 
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  UserCheck,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Building2,
  MapPin,
  Phone,
  Ban
} from "lucide-react";

interface Prenotazione extends DatiEconomiciPrenotazione {
  id: string;
  data_appuntamento: string;
  ora_appuntamento: string;
  metodo_pagamento: string;
  pagato: boolean;
  autista_id: string | null;
  partenza_citta?: string;
  partenza_via?: string;
  arrivo_citta?: string;
  arrivo_via?: string;
  pazienti: { id: string; nome: string; cognome: string; telefono?: string } | null;
  autisti: { id: string; nome: string; cognome: string; telefono?: string | null } | null;
}

export default function ListaPrenotazioni() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [autisti, setAutisti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [erroreAutisti, setErroreAutisti] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const operationLock = useRef(false);
  const [esito, setEsito] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [filterStato, setFilterStato] = useState("tutte");

  // DATA ODIERNA SICURA
  const [todayStr, setTodayStr] = useState<string>("");

  // TAB CENTRALE OPERATIVA
  const [tabAttivo, setTabAttivo] = useState<"oggi" | "da_assegnare" | "tutte">("oggi");

  // FILTRI AGGIUNTIVI
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterAutista, setFilterAutista] = useState("");

  useEffect(() => {
    // Calcolo data locale client-side per evitare avvisi SSR Next.js
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setTodayStr(`${y}-${m}-${day}`);

    fetchAutisti();
    fetchPrenotazioni();
  }, []);

  async function fetchAutisti() {
    setErroreAutisti(null);
    try {
      const { data, error } = await supabase
        .from("autisti")
        .select("id, nome, cognome, telefono")
        .eq("attivo", true)
        .order("cognome", { ascending: true });
      if (error) throw error;
      setAutisti(data || []);
    } catch {
      setErroreAutisti("Elenco autisti non disponibile: assegnazione temporaneamente sospesa.");
    }
  }

  async function fetchPrenotazioni() {
    setLoading(true);
    setErroreCaricamento(null);
    try {
      const { data, error } = await supabase
        .from("prenotazioni")
        .select(`*, pazienti(id, nome, cognome, telefono), autisti(id, nome, cognome, telefono)`)
        .order("data_appuntamento", { ascending: false })
        .order("ora_appuntamento", { ascending: true });

      if (error) throw error;
      setPrenotazioni(data || []);
    } catch (error: any) {
      console.error("Errore fetch prenotazioni:", error.message);
      setErroreCaricamento("Impossibile caricare le prenotazioni. Verifica la connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  // ASSEGNAZIONE / CAMBIO AUTISTA AL VOLO
  async function handleCambioAutista(prenotazioneId: string, nuovoAutistaId: string) {
    if (operationLock.current || erroreAutisti || prenotazioni.find((p) => p.id === prenotazioneId)?.annullata_il) return;
    operationLock.current = true;
    setUpdatingId(prenotazioneId);
    try {
      const val = nuovoAutistaId === "" ? null : nuovoAutistaId;
      const { data, error } = await supabase
        .from("prenotazioni")
        .update({ autista_id: val })
        .eq("id", prenotazioneId)
        .is("annullata_il", null)
        .select("id, autista_id").maybeSingle();

      if (error) throw error;
      if (!data || data.autista_id !== val) throw new Error("Assegnazione non confermata. Aggiorna l’elenco.");

      setPrenotazioni((prev) =>
        prev.map((item) => {
          if (item.id === prenotazioneId) {
            const autistaObj = autisti.find((a) => a.id === val) || null;
            return { ...item, autista_id: val, autisti: autistaObj };
          }
          return item;
        })
      );
    } catch (err: any) {
      alert("Errore durante l'assegnazione dell'autista: " + err.message);
    } finally {
      operationLock.current = false;
      setUpdatingId(null);
    }
  }

  async function confermaOperazione(p: Prenotazione, azione: "annulla" | "rimborso" | "pagamento") {
    if (operationLock.current) return;
    operationLock.current = true;
    try {
      const dettagli = `Paziente: ${p.pazienti ? `${p.pazienti.nome} ${p.pazienti.cognome}` : "Non disponibile"}\nData corsa: ${new Date(p.data_appuntamento + "T00:00:00").toLocaleDateString("it-IT")}\nCosto originale: ${formattaImporto(p.costo)}\n${statoPrenotazione(p)}`;
      if (azione === "annulla") {
        if (p.annullata_il) throw new Error("La prenotazione è già annullata.");
        if (!window.confirm(`ANNULLA PRENOTAZIONE\n\n${dettagli}\n\n${p.pagato ? "Il rimborso integrale sarà obbligatorio e resterà da effettuare." : "Non è previsto alcun rimborso."}\n\nConfermi l’annullamento? Il record sarà conservato.`)) return;
      }
      if (azione === "rimborso") {
        if (!rimborsoPendente(p) || !costoValido(p.costo)) throw new Error("Verifica lo stato e l’importo originale prima del rimborso.");
        if (!window.confirm(`REGISTRA RIMBORSO INTEGRALE\n\n${dettagli}\n\nImporto da restituire: ${formattaImporto(p.costo)} (100%).\n\nConfermi che tutto il denaro è già stato effettivamente restituito? Questa azione registra il rimborso e non trasferisce denaro.`)) return;
      }
      setProcessingId(p.id);
      setEsito(null);
      const aggiornata = azione === "annulla" ? await annullaPrenotazione(supabase, p)
        : azione === "rimborso" ? await registraRimborso(supabase, p)
        : await cambiaPagamento(supabase, p);
      setPrenotazioni((prev) => prev.map((item) => item.id === p.id ? { ...item, ...aggiornata } : item));
      setEsito({ type: "success", text: azione === "pagamento" ? "Stato del pagamento aggiornato." : statoPrenotazione(aggiornata) });
    } catch (error) {
      setEsito({ type: "error", text: error instanceof Error ? error.message : "Operazione non riuscita. Aggiorna l’elenco." });
    } finally {
      operationLock.current = false;
      setProcessingId(null);
    }
  }

  const azionePrenotazione = (p: Prenotazione) => {
    if (p.annullata_il && !rimborsoPendente(p)) return null;
    return (
      <button type="button" disabled={!!processingId || !!updatingId || (rimborsoPendente(p) && !costoValido(p.costo))}
        title={rimborsoPendente(p) && !costoValido(p.costo) ? "Importo originale non disponibile: rimborso non registrabile" : undefined}
        onClick={() => confermaOperazione(p, p.annullata_il ? "rimborso" : "annulla")}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:opacity-50 ${p.annullata_il ? "border-amber-300 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
        {processingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
        {p.annullata_il ? "Registra rimborso" : "Annulla prenotazione"}
      </button>
    );
  };

  const badgePagamento = (p: Prenotazione) => (
    <button type="button" disabled={!!p.annullata_il || !!processingId || !!updatingId}
      onClick={() => confermaOperazione(p, "pagamento")} aria-pressed={p.pagato}
      title={p.annullata_il ? "Storico del pagamento non modificabile" : p.pagato ? "Segna come da incassare" : "Conferma pagamento ricevuto"}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold disabled:cursor-default ${rimborsoPendente(p) ? "border-amber-300 bg-amber-50 text-amber-900" : p.annullata_il ? "border-slate-300 bg-slate-100 text-slate-700" : p.pagato ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
      <CreditCard size={12} className="shrink-0" />{statoPrenotazione(p)}
    </button>
  );

  const resetFilters = () => {
    setSearchTerm("");
    setFilterDate("");
    setFilterAutista("");
    setFilterStato("tutte");
  };

  // CALCOLO CONTATORI
  const corseOggi = todayStr ? prenotazioni.filter((p) => !p.annullata_il && p.data_appuntamento === todayStr) : [];
  const corseDaAssegnare = prenotazioni.filter((p) => !p.annullata_il && !p.autista_id);

  // FILTRAGGIO IN BASE AL TAB SELEZIONATO
  let listaFiltrata = prenotazioni;

  if (tabAttivo === "oggi") {
    listaFiltrata = corseOggi;
  } else if (tabAttivo === "da_assegnare") {
    listaFiltrata = corseDaAssegnare;
  }

  // APPLICAZIONE RICERCHE TESTUALI E FILTRI EXTRA
  if (searchTerm) {
    listaFiltrata = listaFiltrata.filter((p) => {
      const nomeCompleto = `${p.pazienti?.nome || ""} ${p.pazienti?.cognome || ""}`.toLowerCase();
      const tel = (p.pazienti?.telefono || "").toLowerCase();
      const viaPart = (p.partenza_via || "").toLowerCase();
      const cittaPart = (p.partenza_citta || "").toLowerCase();
      const q = searchTerm.toLowerCase();
      return nomeCompleto.includes(q) || tel.includes(q) || viaPart.includes(q) || cittaPart.includes(q);
    });
  }

  if (filterDate && tabAttivo === "tutte") {
    listaFiltrata = listaFiltrata.filter((p) => p.data_appuntamento === filterDate);
  }

  if (filterAutista && tabAttivo !== "da_assegnare") {
    listaFiltrata = listaFiltrata.filter((p) => p.autista_id === filterAutista);
  }

  if (filterStato === "attive") listaFiltrata = listaFiltrata.filter((p) => !p.annullata_il);
  if (filterStato === "annullate") listaFiltrata = listaFiltrata.filter((p) => !!p.annullata_il);
  if (filterStato === "rimborsi") listaFiltrata = listaFiltrata.filter(rimborsoPendente);

  const hasActiveFilters = searchTerm || filterDate || filterAutista || filterStato !== "tutte";

  if (erroreCaricamento && !loading) return <ErroreCaricamento messaggio={erroreCaricamento} onRiprova={() => void fetchPrenotazioni()} />;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* TESTATA CENTRALE OPERATIVA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <Clock size={14} /> Centrale Operativa Corse
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quadro Operativo Servizi
            </h1>
            <p className="text-sm text-slate-500">
              Gestione corse, annullamenti e rimborsi integrali con storico conservato.
            </p>
          </div>

          <Link
            href="/prenotazione"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm self-start sm:self-auto"
          >
            <PlusCircle size={16} />
            <span>Nuova Prenotazione</span>
          </Link>
        </div>

        {esito && <div role={esito.type === "error" ? "alert" : "status"} className={esito.type === "error" ? "rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" : "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"}>{esito.text}</div>}
        <button type="button" onClick={fetchPrenotazioni} disabled={loading || !!processingId || !!updatingId} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 disabled:opacity-50"><RotateCcw size={14} /> Aggiorna elenco</button>

        {erroreAutisti && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{erroreAutisti} <button type="button" onClick={() => void fetchAutisti()} className="font-semibold underline">Riprova</button></div>}

        {/* 3 TASTI TAB UNIFICATI: OGGI, DA ASSEGNARE, TUTTE */}
        <div className="grid grid-cols-3 gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
          {/* TAB 1: OGGI */}
          <button
            onClick={() => { setTabAttivo("oggi"); setFilterStato("tutte"); }}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              tabAttivo === "oggi"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🟢 Turno di Oggi</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              tabAttivo === "oggi" ? "bg-blue-100 text-blue-800" : "bg-slate-300 text-slate-700"
            }`}>
              {corseOggi.length}
            </span>
          </button>

          {/* TAB 2: DA ASSEGNARE */}
          <button
            onClick={() => { setTabAttivo("da_assegnare"); setFilterStato("tutte"); }}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              tabAttivo === "da_assegnare"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-1">
              <AlertTriangle size={15} /> Da Assegnare
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              tabAttivo === "da_assegnare" ? "bg-white text-amber-900" : "bg-amber-200 text-amber-900"
            }`}>
              {corseDaAssegnare.length}
            </span>
          </button>

          {/* TAB 3: TUTTE / ARCHIVIO */}
          <button
            onClick={() => setTabAttivo("tutte")}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
              tabAttivo === "tutte"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📂 Tutte / Archivio</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              tabAttivo === "tutte" ? "bg-slate-900 text-white" : "bg-slate-300 text-slate-700"
            }`}>
              {prenotazioni.length}
            </span>
          </button>
        </div>

        {/* PANNELLO RICERCA E FILTRI */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <SlidersHorizontal size={14} /> Ricerca Rapida
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Azzera Filtri
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Ricerca Testo */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cerca paziente, via o città..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            {/* Filtro Data (Attivo solo se siamo in TUTTE) */}
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
              <input
                type="date"
                disabled={tabAttivo !== "tutte"}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl outline-none ${
                  tabAttivo !== "tutte" 
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                    : "bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-600"
                }`}
              />
            </div>

            {/* Filtro Autista (Attivo solo se non siamo in DA ASSEGNARE) */}
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
              <select
                disabled={tabAttivo === "da_assegnare"}
                value={filterAutista}
                onChange={(e) => setFilterAutista(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl outline-none ${
                  tabAttivo === "da_assegnare" 
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                    : "bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-600"
                }`}
              >
                <option value="">Tutti gli equipaggi</option>

                        {autisti.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} {a.cognome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <label htmlFor="filtro-stato-corsa" className="mb-1 block text-xs font-semibold text-slate-600">Stato prenotazione</label>
          <select id="filtro-stato-corsa" value={filterStato} onChange={(e) => { setFilterStato(e.target.value); if (e.target.value === "annullate" || e.target.value === "rimborsi") setTabAttivo("tutte"); }} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm sm:max-w-sm">
            <option value="tutte">Tutti gli stati</option>
            <option value="attive">Prenotazioni attive</option>
            <option value="annullate">Prenotazioni annullate</option>
            <option value="rimborsi">Rimborsi da effettuare</option>
          </select>
        </div>

        {/* CONTENUTO CORSE */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Loader2 className="animate-spin text-blue-600" size={34} />
            <p className="text-sm font-medium">Sincronizzazione centrale operativa...</p>
          </div>
        ) : listaFiltrata.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
            <p className="font-bold text-slate-800 text-base">Nessuna corsa in questo elenco</p>
            <p className="text-xs text-slate-400">
              {tabAttivo === "da_assegnare" 
                ? "Ottimo lavoro! Tutte le corse hanno già un autista assegnato." 
                : "Nessun servizio corrisponde ai criteri o ai filtri selezionati."}
            </p>
          </div>
        ) : (
          <>
            {/* VISTA MOBILE: CARD TOUCH COMPLETE */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {listaFiltrata.map((p) => {

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl p-4 border shadow-sm space-y-3 ${
                      !p.annullata_il && !p.autista_id ? "border-amber-300 ring-2 ring-amber-400/20" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                          <Clock size={13} />
                          {new Date(p.data_appuntamento).toLocaleDateString("it-IT")} • <strong className="text-slate-800">{p.ora_appuntamento || "--:--"}</strong>
                        </div>
                        <h3 className="font-bold text-slate-900 text-base mt-0.5">
                          {p.pazienti ? `${p.pazienti.nome} ${p.pazienti.cognome}` : "Paziente non assegnato"}
                        </h3>
                        {p.pazienti?.telefono && (
                          <a href={`tel:${p.pazienti.telefono}`} className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                            <Phone size={12} /> {p.pazienti.telefono}
                          </a>
                        )}
                      </div>

                      {badgePagamento(p)}
                    </div>

                    {/* Assegnazione Autista Rapida */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                      <UserCheck size={16} className={p.autista_id ? "text-blue-600" : "text-amber-600"} />
                      <select
                        value={p.autista_id || ""}
                        disabled={!!p.annullata_il || !!processingId || !!updatingId || !!erroreAutisti}
                        onChange={(e) => handleCambioAutista(p.id, e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                      >
                        <option value="">⚠️ NESSUN AUTISTA (Assegna ora)</option>
                        {p.autista_id && !autisti.some((a) => a.id === p.autista_id) && <option value={p.autista_id}>{p.autisti ? `${p.autisti.nome} ${p.autisti.cognome}` : "Autista assegnato"}</option>}
                        {autisti.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome} {a.cognome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Importo, dettaglio e conservazione dello storico */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="font-bold text-slate-900">{formattaImporto(p.costo)}</span>
                      
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Link
                          href={`/prenotazioni/${p.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
                        >
                          <Eye size={13} /> Scheda
                        </Link>
                        
                        <AvvisaAutista autistaId={p.autista_id} telefono={p.autisti?.telefono} />
                        {azionePrenotazione(p)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VISTA DESKTOP: TABELLA CENTRALE OPERATIVA */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl overflow-x-auto border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/75 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Data e Ora</th>
                    <th className="py-3.5 px-4">Paziente</th>
                    <th className="py-3.5 px-4">Tratta Sintetica</th>
                    <th className="py-3.5 px-4">Equipaggio Assegnato</th>
                    <th className="py-3.5 px-4">Importo</th>
                    <th className="py-3.5 px-4 text-center">Pagamento</th>
                    <th className="py-3.5 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {listaFiltrata.map((p) => {

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {new Date(p.data_appuntamento).toLocaleDateString("it-IT")}
                          </div>
                          <div className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                            <Clock size={12} /> {p.ora_appuntamento || "--:--"}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {p.pazienti?.nome} {p.pazienti?.cognome}
                          </div>
                          {p.pazienti?.telefono && (
                            <div className="text-xs text-slate-400 font-mono">
                              {p.pazienti.telefono}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div className="truncate max-w-[180px]">
                            <strong>Da:</strong> {p.partenza_citta || "N.D."}
                          </div>
                          <div className="truncate max-w-[180px]">
                            <strong>A:</strong> {p.arrivo_citta || "N.D."}
                          </div>
                        </td>

                        {/* ASSEGNAZIONE AUTISTA AL VOLO INLINE */}
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <select
                              value={p.autista_id || ""}
                              disabled={!!p.annullata_il || !!processingId || !!updatingId || !!erroreAutisti}
                              onChange={(e) => handleCambioAutista(p.id, e.target.value)}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer transition ${
                                p.autista_id 
                                ? "bg-blue-50/60 border-blue-200 text-blue-900" 
                                : "bg-amber-100 border-amber-300 text-amber-900 font-bold animate-pulse"
                              }`}
                            >
                              <option value="">⚠️ Non Assegnato</option>
                              {p.autista_id && !autisti.some((a) => a.id === p.autista_id) && <option value={p.autista_id}>{p.autisti ? `${p.autisti.nome} ${p.autisti.cognome}` : "Autista assegnato"}</option>}
                        {autisti.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nome} {a.cognome}
                                </option>
                              ))}
                            </select>
                            {updatingId === p.id && <Loader2 size={14} className="animate-spin text-blue-600" />}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900 text-xs">
                          {formattaImporto(p.costo)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {badgePagamento(p)}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex flex-wrap items-center gap-1.5 justify-end">
                            <Link
                              href={`/prenotazioni/${p.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
                              title="Apri scheda di dettaglio"
                            >
                              <Eye size={13} />
                              <span>Dettagli</span>
                            </Link>

                            {/* ANNULLAMENTO / RIMBORSO */}
                            <AvvisaAutista autistaId={p.autista_id} telefono={p.autisti?.telefono} />
                            {azionePrenotazione(p)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
