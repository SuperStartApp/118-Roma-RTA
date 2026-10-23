"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { 
  Search, 
  Calendar, 
  User, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Euro, 
  RotateCcw,
  SlidersHorizontal,
  Loader2
} from "lucide-react";

interface Prenotazione {
  id: string;
  data_appuntamento: string;
  ora_appuntamento: string;
  costo: number;
  metodo_pagamento: string;
  pagato: boolean;
  pazienti: { nome: string; cognome: string } | null;
  autisti: { nome: string; cognome: string } | null;
}

export default function ListaPrenotazioni() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [autisti, setAutisti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // FILTRI
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterAutista, setFilterAutista] = useState("");

  useEffect(() => {
    fetchAutisti();
    fetchPrenotazioni();
  }, []);

  useEffect(() => {
    fetchPrenotazioni();
  }, [searchTerm, filterDate, filterAutista]);

  async function fetchAutisti() {
    const { data } = await supabase
      .from("autisti")
      .select("id, nome, cognome")
      .eq("attivo", true);
    setAutisti(data || []);
  }

  async function fetchPrenotazioni() {
    setLoading(true);
    try {
      let query = supabase
        .from("prenotazioni")
        .select(`*, pazienti(nome, cognome), autisti(nome, cognome)`)
        .order("data_appuntamento", { ascending: false });

      if (filterDate) {
        query = query.eq("data_appuntamento", filterDate);
      }

      if (filterAutista) {
        query = query.eq("autista_id", filterAutista);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (searchTerm) {
        filteredData = filteredData.filter((p) => {
          const nomeCompleto = `${p.pazienti?.nome || ""} ${p.pazienti?.cognome || ""}`.toLowerCase();
          return nomeCompleto.includes(searchTerm.toLowerCase());
        });
      }

      setPrenotazioni(filteredData);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function togglePagamento(id: string, statoAttuale: boolean) {
    const { error } = await supabase
      .from("prenotazioni")
      .update({ pagato: !statoAttuale })
      .eq("id", id);
    if (!error) fetchPrenotazioni();
  }

  const resetFilters = () => {
    setSearchTerm("");
    setFilterDate("");
    setFilterAutista("");
  };

  const hasActiveFilters = searchTerm || filterDate || filterAutista;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* INTESTAZIONE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Archivio Servizi
            </h1>
            <p className="text-sm text-slate-500">
              Storico e gestione delle corse sanitarie prenotate
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-slate-200 text-slate-800">
              {prenotazioni.length} {prenotazioni.length === 1 ? "risultato" : "risultati"}
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition shadow-sm"
              >
                <RotateCcw size={12} />
                Azzera filtri
              </button>
            )}
          </div>
        </div>

        {/* PANNELLO FILTRI */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <SlidersHorizontal size={14} /> Filtra Archivio
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Ricerca Paziente */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
              <input
                type="text"
                placeholder="Cerca per nome paziente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Filtro Data */}
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={17} />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Filtro Autista */}
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={17} />
              <select
                value={filterAutista}
                onChange={(e) => setFilterAutista(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
              >
                <option value="">Tutti gli equipaggi / autisti</option>
                {autisti.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} {a.cognome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* STATO DI CARICAMENTO */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-sm font-medium">Aggiornamento archivio...</p>
          </div>
        ) : prenotazioni.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            <p className="font-semibold text-slate-700">Nessuna corsa trovata</p>
            <p className="text-sm text-slate-400 mt-1">
              Prova a modificare i filtri di ricerca impostati.
            </p>
          </div>
        ) : (
          <>
            {/* VISTA MOBILE: SCHEDE TOUCH FRIENDLY (Schermi piccoli) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {prenotazioni.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Clock size={13} />
                        {new Date(p.data_appuntamento).toLocaleDateString("it-IT")} • {p.ora_appuntamento || "--:--"}
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mt-0.5">
                        {p.pazienti ? `${p.pazienti.nome} ${p.pazienti.cognome}` : "Paziente non specificato"}
                      </h3>
                    </div>
                    {/* Badge Pagamento */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.pagato
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {p.pagato ? "Pagato" : "Da Saldare"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400">Autista: </span>
                      <span className="font-medium">{p.autisti ? `${p.autisti.nome} ${p.autisti.cognome}` : "Non assegnato"}</span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {p.costo ? `${p.costo} €` : "—"}
                    </div>
                  </div>

                  {/* Pulsanti Azione Mobile */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => togglePagamento(p.id, p.pagato)}
                      className={`text-xs py-2 px-3 rounded-lg font-medium border text-center transition ${
                        p.pagato
                          ? "border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                          : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {p.pagato ? "Segna Da Pagare" : "Registra Incasso"}
                    </button>
                    <Link
                      href={`/prenotazioni/${p.id}`}
                      className="inline-flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
                    >
                      <Eye size={14} /> Dettagli
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* VISTA DESKTOP: TABELLA ELEGANTE E PULITA (Schermi grandi) */}
            <div className="hidden md:block bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/75 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Data e Ora</th>
                    <th className="py-3.5 px-4">Paziente</th>
                    <th className="py-3.5 px-4">Equipaggio</th>
                    <th className="py-3.5 px-4">Importo</th>
                    <th className="py-3.5 px-4 text-center">Stato Incasso</th>
                    <th className="py-3.5 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {prenotazioni.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {new Date(p.data_appuntamento).toLocaleDateString("it-IT")}
                        </div>
                        <div className="text-xs text-slate-400">{p.ora_appuntamento || "--:--"}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.pazienti?.nome} {p.pazienti?.cognome}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.autisti ? `${p.autisti.nome} ${p.autisti.cognome}` : (
                          <span className="text-slate-400 italic">Non assegnato</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {p.costo ? `${p.costo} €` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            p.pagato
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {p.pagato ? "Pagato" : "Da Saldare"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => togglePagamento(p.id, p.pagato)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition ${
                              p.pagato
                                ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                                : "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                            }`}
                          >
                            {p.pagato ? "Annulla" : "Incassa"}
                          </button>
                          <Link
                            href={`/prenotazioni/${p.id}`}
                            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Visualizza scheda"
                          >
                            <Eye size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}