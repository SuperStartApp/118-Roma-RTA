"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import { associazione } from "@/app/lib/associazione";
import { caricaPazienti, corrispondeRicercaPaziente } from "@/app/lib/pazienti";
import Link from "next/link";
import { condividiTessera } from "@/app/lib/condivisione-tessera";
import { 
  Users, 
  Search, 
  Phone, 
  MessageSquare, 
  Clock, 
  PlusCircle, 
  ShieldCheck, 
  Activity, 
  Loader2,
  MapPin,
  ArrowRight,
  Edit,
  X,
  Save,
  UserPlus
} from "lucide-react";

interface PazienteConStorico {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  codice_fiscale: string | null;
  residenza: string | null;
  data_nascita?: string | null;
  luogo_nascita?: string | null;
  peso_approssimativo?: string | null;
  patologia: string | null;
  numero_tessera?: number | null;
  anno_tessera?: number | null;
  totaleCorse: number;
  corseAnnullate: number;
  ultimaCorsa: string | null;
}

export default function PazientiPage() {
  const [pazienti, setPazienti] = useState<PazienteConStorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ANNO CORRENTE IMPOSTATO VIA EFFECT PER EVITARE ERRORI NEXT.JS
  const [currentYear, setCurrentYear] = useState<number>(2024);

  // STATI MODAL MODIFICA / CREAZIONE
  const [modalAperto, setModalAperto] = useState(false);
  const [isNuovoPaziente, setIsNuovoPaziente] = useState(false);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const [formPaziente, setFormPaziente] = useState<any>({
    id: "",
    nome: "",
    cognome: "",
    telefono: "",
    codice_fiscale: "",
    residenza: "",
    data_nascita: "",
    luogo_nascita: "",
    peso_approssimativo: "",
    patologia: "",
    numero_tessera: "",
    anno_tessera: 2024
  });

  useEffect(() => {
    // Calcolo sicuro lato client dell'anno
    const anno = new Date().getFullYear();
    setCurrentYear(anno);
    setFormPaziente((prev: any) => ({ ...prev, anno_tessera: anno }));

    fetchPazientiEStorico();
  }, []);

  async function fetchPazientiEStorico() {
    setLoading(true);
    setErroreCaricamento(null);
    try {
      // 1. Carica pazienti
      const { data: pazList, error: pErr } = await caricaPazienti();

      if (pErr) throw pErr;

      // 2. Carica prenotazioni per contatore corse
      const { data: corseList, error: cErr } = await supabase
        .from("prenotazioni")
        .select("paziente_id, data_appuntamento, annullata_il")
        .order("data_appuntamento", { ascending: false });

      if (cErr) throw cErr;

      const corseMap: Record<string, { count: number; cancelled: number; lastDate: string | null }> = {};
      (corseList || []).forEach((c) => {
        if (!c.paziente_id) return;
        if (!corseMap[c.paziente_id]) {
          corseMap[c.paziente_id] = { count: 1, cancelled: c.annullata_il ? 1 : 0, lastDate: c.data_appuntamento };
        } else {
          corseMap[c.paziente_id].count += 1;
          if (c.annullata_il) corseMap[c.paziente_id].cancelled += 1;
        }
      });

      const arricchiti: PazienteConStorico[] = (pazList || []).map((p) => ({
        ...p,
        totaleCorse: corseMap[p.id]?.count || 0,
        corseAnnullate: corseMap[p.id]?.cancelled || 0,
        ultimaCorsa: corseMap[p.id]?.lastDate || null,
      }));

      setPazienti(arricchiti);
    } catch (err: any) {
      console.error("Errore caricamento pazienti:", err);
      setErroreCaricamento("Impossibile caricare pazienti e storico. Verifica la connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  // APRI MODAL MODIFICA
  const apriModifica = (p: PazienteConStorico) => {
    setIsNuovoPaziente(false);
    setFormPaziente({
      id: p.id,
      nome: p.nome || "",
      cognome: p.cognome || "",
      telefono: p.telefono || "",
      codice_fiscale: p.codice_fiscale || "",
      residenza: p.residenza || "",
      data_nascita: p.data_nascita || "",
      luogo_nascita: p.luogo_nascita || "",
      peso_approssimativo: p.peso_approssimativo || "",
      patologia: p.patologia || "",
      numero_tessera: p.numero_tessera || "",
      anno_tessera: p.anno_tessera || currentYear
    });
    setModalAperto(true);
  };

  // APRI MODAL NUOVO PAZIENTE
  const apriNuovo = () => {
    setIsNuovoPaziente(true);
    setFormPaziente({
      id: "",
      nome: "",
      cognome: "",
      telefono: "",
      codice_fiscale: "",
      residenza: "",
      data_nascita: "",
      luogo_nascita: "",
      peso_approssimativo: "",
      patologia: "",
      numero_tessera: "",
      anno_tessera: currentYear
    });
    setModalAperto(true);
  };

  // ASSEGNA AUTOMATICAMENTE IL PROSSIMO NUMERO TESSERA
  const generaNumeroTesseraAuto = async () => {
    try {
      const { data: prossimoNum, error } = await supabase.rpc("genera_prossima_tessera", {
        tabella: "pazienti",
        offset_iniziale: 500
      });
      if (error) throw error;
      setFormPaziente((prev: any) => ({
        ...prev,
        numero_tessera: prossimoNum,
        anno_tessera: currentYear
      }));
    } catch (err: any) {
      alert("Errore generazione numero: " + err.message);
    }
  };

  // SALVATAGGIO MODIFICHE O NUOVO
  const handleSalvaPaziente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvataggioInCorso(true);

    const payload = {
      nome: formPaziente.nome.trim(),
      cognome: formPaziente.cognome.trim(),
      telefono: formPaziente.telefono.trim() || null,
      codice_fiscale: formPaziente.codice_fiscale.trim().toUpperCase() || null,
      residenza: formPaziente.residenza.trim() || null,
      data_nascita: formPaziente.data_nascita || null,
      luogo_nascita: formPaziente.luogo_nascita.trim() || null,
      peso_approssimativo: formPaziente.peso_approssimativo.trim() || null,
      patologia: formPaziente.patologia.trim() || null,
      numero_tessera: formPaziente.numero_tessera ? parseInt(formPaziente.numero_tessera) : null,
      anno_tessera: formPaziente.anno_tessera ? parseInt(formPaziente.anno_tessera) : currentYear,
    };

    try {
      if (isNuovoPaziente) {
        const { error } = await supabase.from("pazienti").insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pazienti").update(payload).eq("id", formPaziente.id);
        if (error) throw error;
      }

      setModalAperto(false);
      fetchPazientiEStorico();
    } catch (err: any) {
      alert("Errore salvataggio: " + err.message);
    } finally {
      setSalvataggioInCorso(false);
    }
  };

  const [condivisioneInCorso, setCondivisioneInCorso] = useState(false);
  const [whatsappPronto, setWhatsappPronto] = useState<string | null>(null);
  const [esitoCondivisione, setEsitoCondivisione] = useState("");
  const revocaLink = async (id: string) => {
    if (condivisioneInCorso || !window.confirm("Revocare il link pubblico? Il cliente non potrà più usarlo.")) return;
    setCondivisioneInCorso(true); setWhatsappPronto(null);
    try { await condividiTessera(id, "revoca"); setEsitoCondivisione("Link revocato."); }
    catch (error) { setEsitoCondivisione(error instanceof Error ? error.message : "Revoca non riuscita."); }
    finally { setCondivisioneInCorso(false); }
  };

  // WHATSAPP
  const apriWhatsApp = async (p: PazienteConStorico) => {
    if (condivisioneInCorso) return;
    if (!p.telefono?.trim()) {
      alert("Numero telefonico mancante: aggiungilo nella scheda paziente prima di inviare la tessera.");
      return;
    }
    if (!p.numero_tessera) {
      alert("Questo paziente non ha ancora un numero tessera. Gestisci il rilascio dalla scheda paziente prima dell’invio.");
      return;
    }
    let num = p.telefono.replace(/\D/g, "");
    if (!num) {
      alert("Il recapito non contiene un numero telefonico utilizzabile. Verifica la scheda paziente.");
      return;
    }
    if (num.length === 10 && !num.startsWith("39")) {
      num = "39" + num;
    }
    setCondivisioneInCorso(true); setWhatsappPronto(null); setEsitoCondivisione("");
    try {
    const { link: linkTessera } = await condividiTessera(p.id, "crea");
    if (!linkTessera) throw new Error("Link non creato.");
    const messaggio =
      `*${associazione.denominazione} — Tessera associativa*\n\n` +
      `Gentile *${p.nome} ${p.cognome}*,\n` +
      `può consultare, stampare o salvare in PDF la Sua tessera associativa al seguente collegamento:\n` +
      `${linkTessera}\n\n` +
      `Un cordiale saluto da ${associazione.denominazione}.`;

    setWhatsappPronto(`https://wa.me/${num}?text=${encodeURIComponent(messaggio)}`);
    setEsitoCondivisione("Nuovo link pronto, valido fino alla scadenza associativa della tessera. Il precedente è stato invalidato. Apri WhatsApp per inviarlo.");
    } catch (error) { setEsitoCondivisione(error instanceof Error ? error.message : "Link non creato."); }
    finally { setCondivisioneInCorso(false); }
  };

  const filteredPazienti = pazienti.filter((p) => corrispondeRicercaPaziente(p, search));

  if (erroreCaricamento && !loading) return <ErroreCaricamento messaggio={erroreCaricamento} onRiprova={() => void fetchPazientiEStorico()} />;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {esitoCondivisione && <p role="status" className="rounded-xl border bg-white p-4 text-sm">{esitoCondivisione}</p>}
        {whatsappPronto && <a href={whatsappPronto} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-green-700 px-4 font-bold text-white">Apri WhatsApp e invia tessera</a>}
        
        {/* INTESTAZIONE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <Users size={14} /> Anagrafica e Tessere
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Rubrica Pazienti & Soci
            </h1>
            <p className="text-sm text-slate-500">
              Gestisci le schede complete, rilascia le tessere socio e avvia i trasporti sanitari.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={apriNuovo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
            >
              <UserPlus size={15} />
              <span>Nuovo Paziente</span>
            </button>
            <Link
              href="/prenotazione"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
            >
              <PlusCircle size={15} />
              <span>Nuovo Trasporto</span>
            </Link>
          </div>
        </div>

        {/* BARRA RICERCA */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
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
            <p className="text-xs text-slate-400 mt-1">Verifica i parametri di ricerca o inseriscine uno nuovo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPazienti.map((p) => {
              const haTessera = Boolean(p.numero_tessera);

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
                          {haTessera && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                              <ShieldCheck size={11} className="text-amber-600" />
                              Socio #{p.numero_tessera}
                            </span>
                          )}
                        </div>

                        {p.codice_fiscale && (
                          <span className="text-xs font-mono text-slate-400 block mt-0.5">
                            CF: {p.codice_fiscale}
                          </span>
                        )}
                      </div>

                      {/* Tasto Modifica Anagrafica */}
                      <button
                        onClick={() => apriModifica(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        title="Modifica scheda anagrafica"
                      >
                        <Edit size={13} />
                        <span>Modifica</span>
                      </button>
                    </div>

                    {/* Dati Clinici & Recapiti */}
                    <p className="mt-3 text-xs text-slate-600">Prenotazioni: {p.totaleCorse} · Non annullate: {p.totaleCorse - p.corseAnnullate} · Annullate: {p.corseAnnullate}</p>
                    <div className="pt-3 space-y-2 text-xs text-slate-600">
                      {p.telefono && (
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Phone size={13} className="text-blue-600 shrink-0" />
                          <span>{p.telefono}</span>
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

                  {/* Barra Azioni */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => apriWhatsApp(p)}
                          disabled={condivisioneInCorso || !p.telefono?.trim() || !haTessera}
                          className="inline-flex min-h-11 items-center gap-1.5 p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition border border-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          title={!p.telefono?.trim() ? "Aggiungi un numero telefonico nella scheda paziente" : !haTessera ? "Numero tessera non ancora assegnato" : "Invia il collegamento alla tessera su WhatsApp"}
                        >
                          <MessageSquare size={14} />
                          <span>{!p.telefono?.trim() ? "Telefono mancante" : !haTessera ? "Tessera da assegnare" : "Invia tessera WhatsApp"}</span>
                        </button>

                      {haTessera && <button type="button" disabled={condivisioneInCorso} onClick={() => void revocaLink(p.id)} className="min-h-11 rounded-lg border px-3 text-xs font-bold disabled:opacity-50">Revoca link</button>}
                      {haTessera && (
                        <Link
                          href={`/tessera/${p.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition"
                          title="Vedi Tessera Ufficiale"
                        >
                          <ShieldCheck size={13} className="text-amber-600" />
                          <span>Tessera</span>
                        </Link>
                      )}
                    </div>

                    <Link
                      href={`/prenotazione?paziente_id=${p.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition ml-auto shadow-sm"
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

      {/* MODAL MODIFICA / CREAZIONE PAZIENTE COMPLETO */}
      {modalAperto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isNuovoPaziente ? "Inserimento Nuovo Paziente" : "Modifica Scheda Paziente"}
                </h2>
                <p className="text-xs text-slate-500">
                  Aggiorna recapiti, patologia e riferimenti della tessera socio.
                </p>
              </div>
              <button
                onClick={() => setModalAperto(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSalvaPaziente} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome *</label>
                  <input
                    type="text"
                    required
                    value={formPaziente.nome}
                    onChange={(e) => setFormPaziente({ ...formPaziente, nome: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cognome *</label>
                  <input
                    type="text"
                    required
                    value={formPaziente.cognome}
                    onChange={(e) => setFormPaziente({ ...formPaziente, cognome: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefono</label>
                  <input
                    type="tel"
                    placeholder="es. 3331234567"
                    value={formPaziente.telefono}
                    onChange={(e) => setFormPaziente({ ...formPaziente, telefono: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Codice Fiscale</label>
                  <input
                    type="text"
                    placeholder="16 caratteri"
                    value={formPaziente.codice_fiscale}
                    onChange={(e) => setFormPaziente({ ...formPaziente, codice_fiscale: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Indirizzo di Residenza</label>
                <input
                  type="text"
                  placeholder="Via, Civico, Città"
                  value={formPaziente.residenza}
                  onChange={(e) => setFormPaziente({ ...formPaziente, residenza: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data di Nascita</label>
                  <input
                    type="date"
                    value={formPaziente.data_nascita}
                    onChange={(e) => setFormPaziente({ ...formPaziente, data_nascita: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Peso Approx (kg)</label>
                  <input
                    type="text"
                    placeholder="es. 75 kg"
                    value={formPaziente.peso_approssimativo}
                    onChange={(e) => setFormPaziente({ ...formPaziente, peso_approssimativo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Patologia / Segnalazioni Cliniche</label>
                <textarea
                  rows={2}
                  placeholder="Note sulle condizioni sanitarie o mobilità..."
                  value={formPaziente.patologia}
                  onChange={(e) => setFormPaziente({ ...formPaziente, patologia: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* SEZIONE TESSERA SOCIO SOSTENITORE */}
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                    <ShieldCheck size={15} className="text-amber-600" />
                    Tessera Socio Sostenitore
                  </span>
                  {!formPaziente.numero_tessera && (
                    <button
                      type="button"
                      onClick={generaNumeroTesseraAuto}
                      className="text-[11px] font-bold text-amber-800 bg-amber-200/60 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition"
                    >
                      Assegna Prossimo N°
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 uppercase block mb-0.5">N° Tessera</label>
                    <input
                      type="number"
                      placeholder="es. 501"
                      value={formPaziente.numero_tessera}
                      onChange={(e) => setFormPaziente({ ...formPaziente, numero_tessera: e.target.value })}
                      className="w-full bg-white border border-amber-200 rounded-xl p-2 text-xs font-bold font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 uppercase block mb-0.5">Anno Validità</label>
                    <input
                      type="number"
                      value={formPaziente.anno_tessera}
                      onChange={(e) => setFormPaziente({ ...formPaziente, anno_tessera: e.target.value })}
                      className="w-full bg-white border border-amber-200 rounded-xl p-2 text-xs font-bold font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Pulsanti Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAperto(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={salvataggioInCorso}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50"
                >
                  {salvataggioInCorso ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  <span>Salva Scheda</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
