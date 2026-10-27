"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
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
  Trash2
} from "lucide-react";

interface Prenotazione {
  id: string;
  data_appuntamento: string;
  ora_appuntamento: string;
  costo: number;
  metodo_pagamento: string;
  pagato: boolean;
  autista_id: string | null;
  partenza_citta?: string;
  partenza_via?: string;
  arrivo_citta?: string;
  arrivo_via?: string;
  pazienti: { id: string; nome: string; cognome: string; telefono?: string } | null;
  autisti: { id: string; nome: string; cognome: string } | null;
}

export default function ListaPrenotazioni() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [autisti, setAutisti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    const { data } = await supabase
      .from("autisti")
      .select("id, nome, cognome")
      .eq("attivo", true)
      .order("cognome", { ascending: true });
    setAutisti(data || []);
  }

  async function fetchPrenotazioni() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prenotazioni")
        .select(`*, pazienti(id, nome, cognome, telefono), autisti(id, nome, cognome)`)
        .order("data_appuntamento", { ascending: false })
        .order("ora_appuntamento", { ascending: true });

      if (error) throw error;
      setPrenotazioni(data || []);
    } catch (error: any) {
      console.error("Errore fetch prenotazioni:", error.message);
    } finally {
      setLoading(false);
    }
  }

  // ASSEGNAZIONE / CAMBIO AUTISTA AL VOLO
  async function handleCambioAutista(prenotazioneId: string, nuovoAutistaId: string) {
    setUpdatingId(prenotazioneId);
    try {
      const val = nuovoAutistaId === "" ? null : nuovoAutistaId;
      const { error } = await supabase
        .from("prenotazioni")
        .update({ autista_id: val })
        .eq("id", prenotazioneId);

      if (error) throw error;

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
      setUpdatingId(null);
    }
  }

  // TOGGLE STATO PAGAMENTO
  async function togglePagamento(id: string, statoAttuale: boolean) {
    try {
      const { error } = await supabase
        .from("prenotazioni")
        .update({ pagato: !statoAttuale })
        .eq("id", id);

      if (error) throw error;

      setPrenotazioni((prev) =>
        prev.map((item) => (item.id === id ? { ...item, pagato: !statoAttuale } : item))
      );
    } catch (err: any) {
      alert("Errore aggiornamento pagamento: " + err.message);
    }
  }

  // ELIMINA PRENOTAZIONE CON CONFERMA
  async function handleEliminaPrenotazione(id: string, nomePaziente?: string) {
    const conferma = window.confirm(
      `Sei sicuro di voler eliminare la corsa ${nomePaziente ? `di ${nomePaziente}` : ""}? L'operazione non può essere annullata.`
    );
    if (!conferma) return;

    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("prenotazioni")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Rimuoviamo la corsa dalla lista all'istante
      setPrenotazioni((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert("Errore durante l'eliminazione: " + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const resetFilters = () => {
    setSearchTerm("");
    setFilterDate("");
    setFilterAutista("");
  };

  // CALCOLO CONTATORI
  const corseOggi = todayStr ? prenotazioni.filter((p) => p.data_appuntamento === todayStr) : [];
  const corseDaAssegnare = prenotazioni.filter((p) => !p.autista_id);

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

  const hasActiveFilters = searchTerm || filterDate || filterAutista;

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
              Gestione orari, assegnazione tempestiva equipaggi e cancellazione servizi.
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

        {/* 3 TASTI TAB UNIFICATI: OGGI, DA ASSEGNARE, TUTTE */}
        <div className="grid grid-cols-3 gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
          {/* TAB 1: OGGI */}
          <button
            onClick={() => setTabAttivo("oggi")}
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
            onClick={() => setTabAttivo("da_assegnare")}
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
                const isDeleting = deletingId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl p-4 border shadow-sm space-y-3 ${
                      !p.autista_id ? "border-amber-300 ring-2 ring-amber-400/20" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between">
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

                      <button
                        onClick={() => togglePagamento(p.id, p.pagato)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition ${
                          p.pagato
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        {p.pagato ? "Pagato" : "Da Saldare"}
                      </button>
                    </div>

                    {/* Assegnazione Autista Rapida */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                      <UserCheck size={16} className={p.autista_id ? "text-blue-600" : "text-amber-600"} />
                      <select
                        value={p.autista_id || ""}
                        disabled={updatingId === p.id}
                        onChange={(e) => handleCambioAutista(p.id, e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                      >
                        <option value="">⚠️ NESSUN AUTISTA (Assegna ora)</option>
                        {autisti.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome} {a.cognome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Azioni Mobile: Importo, Dettagli ed Elimina */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="font-bold text-slate-900">{p.costo ? `${p.costo} €` : "Tariffa n.d."}</span>
                      
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/prenotazioni/${p.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
                        >
                          <Eye size={13} /> Scheda
                        </Link>
                        
                        <button
                          disabled={isDeleting}
                          onClick={() => handleEliminaPrenotazione(p.id, `${p.pazienti?.nome || ""} ${p.pazienti?.cognome || ""}`.trim())}
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                          title="Elimina corsa"
                        >
                          {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VISTA DESKTOP: TABELLA CENTRALE OPERATIVA */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl overflow-hidden border border-slate-200">
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
                    const isDeleting = deletingId === p.id;

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
                              disabled={updatingId === p.id}
                              onChange={(e) => handleCambioAutista(p.id, e.target.value)}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer transition ${
                                p.autista_id 
                                ? "bg-blue-50/60 border-blue-200 text-blue-900" 
                                : "bg-amber-100 border-amber-300 text-amber-900 font-bold animate-pulse"
                              }`}
                            >
                              <option value="">⚠️ Non Assegnato</option>
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
                          {p.costo ? `${p.costo} €` : "—"}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => togglePagamento(p.id, p.pagato)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                              p.pagato
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300"
                            }`}
                          >
                            <CreditCard size={12} />
                            <span>{p.pagato ? "Pagato" : "Incassa"}</span>
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Link
                              href={`/prenotazioni/${p.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
                              title="Apri scheda di dettaglio"
                            >
                              <Eye size={13} />
                              <span>Dettagli</span>
                            </Link>

                            {/* TASTO ELIMINA */}
                            <button
                              disabled={isDeleting}
                              onClick={() => handleEliminaPrenotazione(p.id, `${p.pazienti?.nome || ""} ${p.pazienti?.cognome || ""}`.trim())}
                              className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                              title="Elimina corsa definitivamente"
                            >
                              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
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