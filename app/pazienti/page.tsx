"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { 
  Users, 
  Search, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Clock, 
  PlusCircle, 
  ShieldCheck, 
  Activity, 
  Loader2,
  MapPin,
  ArrowRight
} from "lucide-react";

interface PazienteConStorico {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  codice_fiscale: string | null;
  residenza: string | null;
  patologia: string | null;
  totaleCorse: number;
  ultimaCorsa: string | null;
}

export default function PazientiPage() {
  const [pazienti, setPazienti] = useState<PazienteConStorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPazientiEStorico();
  }, []);

  async function fetchPazientiEStorico() {
    setLoading(true);
    try {
      // 1. Carica pazienti
      const { data: pazList, error: pErr } = await supabase
        .from("pazienti")
        .select("*")
        .order("cognome", { ascending: true });

      if (pErr) throw pErr;

      // 2. Carica prenotazioni per calcolare lo storico
      const { data: corseList, error: cErr } = await supabase
        .from("prenotazioni")
        .select("paziente_id, data_appuntamento")
        .order("data_appuntamento", { ascending: false });

      if (cErr) throw cErr;

      // Mappa delle corse per paziente
      const corseMap: Record<string, { count: number; lastDate: string | null }> = {};
      (corseList || []).forEach((c) => {
        if (!c.paziente_id) return;
        if (!corseMap[c.paziente_id]) {
          corseMap[c.paziente_id] = { count: 1, lastDate: c.data_appuntamento };
        } else {
          corseMap[c.paziente_id].count += 1;
        }
      });

      const arricchiti: PazienteConStorico[] = (pazList || []).map((p) => ({
        ...p,
        totaleCorse: corseMap[p.id]?.count || 0,
        ultimaCorsa: corseMap[p.id]?.lastDate || null,
      }));

      setPazienti(arricchiti);
    } catch (err: any) {
      console.error("Errore caricamento pazienti:", err);
    } finally {
      setLoading(false);
    }
  }

  const apriWhatsApp = (nome: string, telefono: string) => {
    let num = telefono.replace(/\D/g, "");
    if (num.length === 10 && !num.startsWith("39")) {
      num = "39" + num;
    }
    const msg = encodeURIComponent(`Gentile ${nome}, la contattiamo dalla centrale operativa AmbulancePro.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  };

  const filteredPazienti = pazienti.filter((p) => {
    const query = search.toLowerCase();
    const nomeCompleto = `${p.nome} ${p.cognome}`.toLowerCase();
    const cf = (p.codice_fiscale || "").toLowerCase();
    const tel = (p.telefono || "").toLowerCase();
    return nomeCompleto.includes(query) || cf.includes(query) || tel.includes(query);
  });

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* INTESTAZIONE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <Users size={14} /> Anagrafica Clienti
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Rubrica Pazienti & Storico
            </h1>
            <p className="text-sm text-slate-500">
              Gestione degli assistiti con indicazione delle corse effettuate e contatto rapido.
            </p>
          </div>

          <Link
            href="/prenotazione"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm self-start sm:self-auto"
          >
            <PlusCircle size={15} />
            <span>Nuovo Trasporto</span>
          </Link>
        </div>

        {/* BARRA RICERCA */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Cerca per nome, cognome, codice fiscale o cellulare..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Azzera
            </button>
          )}
        </div>

        {/* LISTA PAZIENTI */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-sm font-medium">Caricamento anagrafiche in corso...</p>
          </div>
        ) : filteredPazienti.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700">Nessun paziente trovato</p>
            <p className="text-xs text-slate-400 mt-1">Verifica i parametri di ricerca inseriti.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPazienti.map((p) => {
              const isAbituale = p.totaleCorse > 1;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-slate-300 transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Testata Card */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-slate-900 leading-tight">
                            {p.nome} {p.cognome}
                          </h2>
                          {isAbituale ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <ShieldCheck size={11} /> Abituale
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                              Nuovo
                            </span>
                          )}
                        </div>

                        {p.codice_fiscale && (
                          <span className="text-xs font-mono text-slate-400 block mt-0.5">
                            CF: {p.codice_fiscale}
                          </span>
                        )}
                      </div>

                      {/* Badge Totale Corse */}
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg block">
                          {p.totaleCorse} {p.totaleCorse === 1 ? "corsa" : "corse"}
                        </span>
                      </div>
                    </div>

                    {/* Metadati Paziente */}
                    <div className="pt-3 space-y-2 text-xs text-slate-600">
                      {p.ultimaCorsa && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          <span>Ultimo servizio effettuato: <strong className="text-slate-700">{new Date(p.ultimaCorsa).toLocaleDateString("it-IT")}</strong></span>
                        </div>
                      )}

                      {p.residenza && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span>{p.residenza}</span>
                        </div>
                      )}

                      {p.patologia && (
                        <div className="flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                          <Activity size={13} className="text-rose-500 shrink-0 mt-0.5" />
                          <span className="text-slate-700 font-medium">{p.patologia}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pulsanti Rapidi WhatsApp e Chiamata */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {p.telefono ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => apriWhatsApp(p.nome, p.telefono!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                          title="Invia messaggio WhatsApp"
                        >
                          <MessageSquare size={13} />
                          <span>WhatsApp</span>
                        </button>

                        <a
                          href={`tel:${p.telefono}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                          title="Chiama al cellulare"
                        >
                          <Phone size={13} />
                          <span>Chiama</span>
                        </a>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Nessun recapito telefonico</span>
                    )}

                    <Link
                      href="/prenotazione"
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition ml-auto"
                    >
                      <span>Nuova Corsa</span>
                      <ArrowRight size={13} />
                    </Link>
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