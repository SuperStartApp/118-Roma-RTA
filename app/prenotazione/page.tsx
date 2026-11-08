"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/app/lib/supabase";
import { caricaPazienti, corrispondeRicercaPaziente, type PazienteAnagrafica } from "@/app/lib/pazienti";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  User, 
  CalendarDays, 
  MapPin, 
  Building, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  PlusCircle, 
  Stethoscope, 
  Wind, 
  ArrowRight, 
  Phone, 
  MessageSquare, 
  Sparkles, 
  X,
  ShieldCheck
} from "lucide-react";

function datiAnagrafici(paziente?: PazienteAnagrafica) {
  return {
    nome: paziente?.nome || "",
    cognome: paziente?.cognome || "",
    telefono: paziente?.telefono || "",
    data_nascita: paziente?.data_nascita || "",
    luogo_nascita: paziente?.luogo_nascita || "",
    codice_fiscale: paziente?.codice_fiscale || "",
    residenza: paziente?.residenza || "",
    peso_approssimativo: paziente?.peso_approssimativo || "",
    patologia: paziente?.patologia || "",
  };
}

function PrenotazioneFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pazienteIdFromUrl = searchParams.get("paziente_id");

  const [loading, setLoading] = useState(false);
  const [loadingPaziente, setLoadingPaziente] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [autisti, setAutisti] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [loadingAutisti, setLoadingAutisti] = useState(true);
  const [erroreAutisti, setErroreAutisti] = useState<string | null>(null);
  const [pazienti, setPazienti] = useState<PazienteAnagrafica[]>([]);
  const [ricercaPaziente, setRicercaPaziente] = useState("");
  const [loadingArchivio, setLoadingArchivio] = useState(true);
  const [erroreArchivio, setErroreArchivio] = useState<string | null>(null);
  const [errorePaziente, setErrorePaziente] = useState<string | null>(null);
  const [ricaricaArchivio, setRicaricaArchivio] = useState(0);
  const [ricaricaAutisti, setRicaricaAutisti] = useState(0);
  const [ricaricaPaziente, setRicaricaPaziente] = useState(0);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);
  const [existingPazienteId, setExistingPazienteId] = useState<string | null>(null);
  const pazienteCreatoRef = useRef<string | null>(null);
  const [tesseraSocioInfo, setTesseraSocioInfo] = useState<string | null>(null);

  const initialFormState = {
    // Paziente
    nome: "",
    cognome: "",
    telefono: "",
    data_nascita: "",
    luogo_nascita: "",
    codice_fiscale: "",
    residenza: "",
    peso_approssimativo: "",
    patologia: "",
    // Corsa
    data_appuntamento: "",
    ora_appuntamento: "",
    serve_ossigeno: false,
    serve_medico: false,
    note: "",
    // Partenza
    partenza_citta: "",
    partenza_via: "",
    partenza_civico: "",
    partenza_piano: "",
    partenza_interno: "",
    partenza_ascensore: true,
    partenza_dettagli_ospedale: "",
    // Arrivo
    arrivo_citta: "",
    arrivo_via: "",
    arrivo_civico: "",
    arrivo_piano: "",
    arrivo_interno: "",
    arrivo_ascensore: true,
    arrivo_dettagli_ospedale: "",
    // Condizioni Economiche
    costo: "",
    ore_incluse: "",
    costo_ora_supplementare: "",
    metodo_pagamento: "Contanti",
    pagato: false,
    autista_id: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  // 1. CARICAMENTO AUTISTI
  useEffect(() => {
    let cancelled = false;
    async function loadAutisti() {
      setLoadingAutisti(true);
      setErroreAutisti(null);
      try {
        const { data, error } = await supabase
          .from("autisti")
          .select("id, nome, cognome")
          .eq("attivo", true)
          .order("cognome", { ascending: true });
        if (error) throw error;
        if (!cancelled) setAutisti(data || []);
      } catch {
        if (!cancelled) setErroreAutisti("Impossibile caricare gli autisti. Puoi assegnare l’autista in seguito.");
      } finally {
        if (!cancelled) setLoadingAutisti(false);
      }
    }
    loadAutisti();
    return () => { cancelled = true; };
  }, [ricaricaAutisti]);

  useEffect(() => {
    let cancelled = false;
    async function loadArchivio() {
      setLoadingArchivio(true);
      setErroreArchivio(null);
      try {
        const { data, error } = await caricaPazienti();
        if (error) throw error;
        if (!cancelled) setPazienti(data || []);
      } catch {
        if (!cancelled) setErroreArchivio("Ricerca pazienti non disponibile. Prima di creare una nuova anagrafica, verifica la rubrica.");
      } finally {
        if (!cancelled) setLoadingArchivio(false);
      }
    }
    loadArchivio();
    return () => { cancelled = true; };
  }, [ricaricaArchivio, statusMessage?.type]);

  // 2. GESTIONE SELEZIONE / SVUOTAMENTO PAZIENTE
  useEffect(() => {
    let cancelled = false;
    if (!pazienteIdFromUrl) {
      pazienteCreatoRef.current = null;
      setExistingPazienteId(null);
      setTesseraSocioInfo(null);
      setErrorePaziente(null);
      setLoadingPaziente(false);
      setFormData((prev) => ({ ...prev, ...datiAnagrafici() }));
      return;
    }

    async function loadPazienteData() {
      setLoadingPaziente(true);
      setErrorePaziente(null);
      try {
        const { data, error } = await supabase
          .from("pazienti")
          .select("*")
          .eq("id", pazienteIdFromUrl)
          .single();

        if (error) throw error;
        if (cancelled) return;
        if (data) {
          setExistingPazienteId(data.id);
          setTesseraSocioInfo(data.numero_tessera
            ? `Socio Sostenitore N° #${data.numero_tessera}/${data.anno_tessera || ""}`
            : null);
          setFormData((prev) => ({
            ...prev,
            ...datiAnagrafici(data),
          }));
        }
      } catch (err) {
        console.error("Errore recupero paziente da URL:", err);
        if (!cancelled) setErrorePaziente("Impossibile caricare il paziente selezionato. Cercalo di nuovo o scegli Nuovo paziente.");
      } finally {
        if (!cancelled) setLoadingPaziente(false);
      }
    }

    loadPazienteData();
    return () => { cancelled = true; };
  }, [pazienteIdFromUrl, ricaricaPaziente]);

  const resetFormNuovoPaziente = () => {
    pazienteCreatoRef.current = null;
    setExistingPazienteId(null);
    setTesseraSocioInfo(null);
    setErrorePaziente(null);
    setRicercaPaziente("");
    setFormData((prev) => ({ ...prev, ...datiAnagrafici() }));
    router.replace("/prenotazione", { scroll: false });
  };

  const selezionaPaziente = (id: string) => {
    pazienteCreatoRef.current = null;
    setRicercaPaziente("");
    if (id === pazienteIdFromUrl) setRicaricaPaziente((n) => n + 1);
    router.replace(`/prenotazione?paziente_id=${encodeURIComponent(id)}`, { scroll: false });
  };

  const risultatiPazienti = ricercaPaziente.trim()
    ? pazienti.filter((p) => corrispondeRicercaPaziente(p, ricercaPaziente.trim()))
    : [];
  const normalizzaCF = (value: string) => value.replace(/\s/g, "").toUpperCase();
  const duplicatiCF = existingPazienteId || !normalizzaCF(formData.codice_fiscale)
    ? []
    : pazienti.filter((p) => normalizzaCF(p.codice_fiscale || "") === normalizzaCF(formData.codice_fiscale));
  const possibiliDuplicati = existingPazienteId || !formData.nome.trim() || !formData.cognome.trim()
    ? []
    : pazienti.filter((p) => p.nome.trim().toLowerCase() === formData.nome.trim().toLowerCase()
      && p.cognome.trim().toLowerCase() === formData.cognome.trim().toLowerCase());
  const pazienteInCaricamento = loadingPaziente || (!!pazienteIdFromUrl && pazienteIdFromUrl !== existingPazienteId);
  const autistaSelezionato = autisti.find((a) => a.id === formData.autista_id);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? target.checked : value,
    }));
  };

  const generaMessaggioWhatsApp = () => {
    const dataFormatted = formData.data_appuntamento
      ? new Date(formData.data_appuntamento).toLocaleDateString("it-IT")
      : "";

    const testo = 
`🚑 *ROMA R.T.A. - TRASPORTO SANITARIO*
_Ente Accreditato Regione Lazio_

Gentile *${formData.nome.trim()} ${formData.cognome.trim()}*,
Le confermiamo la prenotazione del servizio:

📅 *Data servizio:* ${dataFormatted}
⏰ *Orario convocazione:* ore ${formData.ora_appuntamento}

📍 *Ritiro:* ${formData.partenza_via} ${formData.partenza_civico || ""}, ${formData.partenza_citta}
🏥 *Destinazione:* ${formData.arrivo_via} ${formData.arrivo_civico || ""}, ${formData.arrivo_citta}
${formData.costo ? `💶 *Importo concordato:* ${formData.costo} €` : ""}

_Il nostro equipaggio sarà a Vostra disposizione. Per comunicazioni o variazioni può rispondere direttamente a questo messaggio._`;

    let num = formData.telefono.replace(/\D/g, "");
    if (num.length === 10 && !num.startsWith("39")) {
      num = "39" + num;
    }

    return `https://wa.me/${num}?text=${encodeURIComponent(testo)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    setWhatsAppUrl(null);

    try {
      let finalPazienteId = existingPazienteId || pazienteCreatoRef.current;

      // Se il paziente NON esiste già, creiamo il nuovo record
      if (!finalPazienteId) {
        const { data: paziente, error: pError } = await supabase
          .from("pazienti")
          .insert([
            {
              nome: formData.nome.trim(),
              cognome: formData.cognome.trim(),
              telefono: formData.telefono.trim() || null,
              data_nascita: formData.data_nascita || null,
              luogo_nascita: formData.luogo_nascita.trim() || null,
              codice_fiscale: formData.codice_fiscale.trim().toUpperCase() || null,
              residenza: formData.residenza.trim() || null,
              peso_approssimativo: formData.peso_approssimativo.trim() || null,
              patologia: formData.patologia.trim() || null,
            },
          ])
          .select()
          .single();

        if (pError) throw pError;
        finalPazienteId = paziente.id;
        pazienteCreatoRef.current = paziente.id;
        setExistingPazienteId(paziente.id);
      }

      // Normalizziamo il metodo di pagamento per garantire compatibilità con Supabase
      const metodoScelto = formData.metodo_pagamento || "Contanti";

      // Inserimento Corsa
      const { error: rError } = await supabase.from("prenotazioni").insert([
        {
          paziente_id: finalPazienteId,
          autista_id: formData.autista_id || null,
          data_appuntamento: formData.data_appuntamento,
          ora_appuntamento: formData.ora_appuntamento,
          serve_ossigeno: formData.serve_ossigeno,
          serve_medico: formData.serve_medico,
          note: formData.note.trim() || null,
          partenza_citta: formData.partenza_citta.trim(),
          partenza_via: formData.partenza_via.trim(),
          partenza_civico: formData.partenza_civico.trim() || null,
          partenza_piano: formData.partenza_piano.trim() || null,
          partenza_interno: formData.partenza_interno.trim() || null,
          partenza_ascensore: formData.partenza_ascensore,
          partenza_dettagli_ospedale: formData.partenza_dettagli_ospedale.trim() || null,
          arrivo_citta: formData.arrivo_citta.trim(),
          arrivo_via: formData.arrivo_via.trim(),
          arrivo_civico: formData.arrivo_civico.trim() || null,
          arrivo_piano: formData.arrivo_piano.trim() || null,
          arrivo_interno: formData.arrivo_interno.trim() || null,
          arrivo_ascensore: formData.arrivo_ascensore,
          arrivo_dettagli_ospedale: formData.arrivo_dettagli_ospedale.trim() || null,
          costo: formData.costo ? parseFloat(formData.costo) : 0,
          ore_incluse: formData.ore_incluse ? parseFloat(formData.ore_incluse) : 0,
          costo_ora_supplementare: formData.costo_ora_supplementare ? parseFloat(formData.costo_ora_supplementare) : 0,
          metodo_pagamento: metodoScelto,
          pagato: formData.pagato,
        },
      ]);

      if (rError) throw rError;

      // Apertura immediata di WhatsApp se c'è un recapito telefonico
      if (formData.telefono.trim()) {
        const waLink = generaMessaggioWhatsApp();
        setWhatsAppUrl(waLink);
        window.open(waLink, "_blank");
      }

      setStatusMessage({
        type: "success",
        text: "Servizio registrato con successo nel sistema!",
      });

      // Reset completo e pulizia URL
      pazienteCreatoRef.current = null;
      setFormData(initialFormState);
      setExistingPazienteId(null);
      setTesseraSocioInfo(null);
      router.replace("/prenotazione");
      window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error: any) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text: "Impossibile salvare la corsa: " + (error?.message || "Errore sconosciuto"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      
      {/* INTESTAZIONE */}
      <div className="pb-3 border-b border-slate-200">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
          <PlusCircle size={14} /> Accettazione & Dispacciamento
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Nuovo Servizio di Trasporto Sanitario
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {existingPazienteId
            ? "I dati anagrafici sono stati caricati automaticamente dalla rubrica."
            : "Inserisci i dati del trasporto: al salvataggio partirà automaticamente la notifica WhatsApp di conferma."}
        </p>

        {/* BOX DI SEGNALAZIONE PAZIENTE CENSITO / SOCIO SOSTENITORE */}
        {existingPazienteId && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Sparkles size={16} className="text-blue-600 shrink-0" />
                <span>Paziente in archivio: {formData.nome} {formData.cognome}</span>
              </div>
              {tesseraSocioInfo && (
                <div className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 text-[11px] mt-1">
                  <ShieldCheck size={13} className="text-amber-700" />
                  <span>{tesseraSocioInfo}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={resetFormNuovoPaziente}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold transition shadow-sm self-start sm:self-auto"
            >
              <X size={13} />
              <span>Scollega / Nuovo Paziente</span>
            </button>
          </div>
        )}
      </div>

      {/* FEEDBACK STATUS BANNER */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === "success" ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>

          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm shrink-0"
            >
              <MessageSquare size={14} />
              <span>Riapri Notifica WhatsApp</span>
            </a>
          )}
        </div>
      )}

        <form onSubmit={(e) => {
          if (loading || pazienteInCaricamento || errorePaziente || duplicatiCF.length > 0 || (!existingPazienteId && loadingArchivio)) {
            e.preventDefault();
            return;
          }
          void handleSubmit(e);
        }} className="space-y-4">
          <section className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3" aria-labelledby="ricerca-paziente-label">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label id="ricerca-paziente-label" htmlFor="ricerca-paziente" className="text-sm font-bold text-slate-900">1. Cerca o inserisci il paziente</label>
              <button type="button" onClick={resetFormNuovoPaziente} disabled={loading} className="text-sm font-semibold text-blue-700 underline disabled:opacity-50">Nuovo paziente</button>
            </div>
            <input
              id="ricerca-paziente"
              type="search"
              value={ricercaPaziente}
              onChange={(e) => setRicercaPaziente(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              disabled={loading}
              placeholder="Nome, cognome, telefono o codice fiscale"
              autoComplete="off"
              aria-describedby="ricerca-paziente-stato"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            />
            <div id="ricerca-paziente-stato" role="status" className="text-xs text-slate-600">
              {loadingArchivio ? "Caricamento rubrica…" : erroreArchivio || (ricercaPaziente.trim()
                ? `${risultatiPazienti.length} pazienti trovati.${risultatiPazienti.length > 10 ? " Sono mostrati i primi 10: affina la ricerca." : ""}`
                : "Cerca in rubrica prima di creare una nuova anagrafica. Il cambio paziente conserva i dati del trasporto.")}
            </div>
            {erroreArchivio && <button type="button" disabled={loading} onClick={() => setRicaricaArchivio((n) => n + 1)} className="text-xs text-blue-700 underline">Riprova a caricare la rubrica</button>}
            {ricercaPaziente.trim() && risultatiPazienti.length > 0 && (
              <ul aria-label="Risultati ricerca pazienti" className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                {risultatiPazienti.slice(0, 10).map((p) => (
                  <li key={p.id}>
                    <button type="button" disabled={loading} onClick={() => selezionaPaziente(p.id)} className="w-full p-3 text-left text-sm hover:bg-blue-50 focus-visible:bg-blue-50">
                      <span className="font-semibold">{p.nome} {p.cognome}</span>
                      <span className="block text-xs text-slate-500">{[p.telefono, p.codice_fiscale, p.data_nascita].filter(Boolean).join(" · ") || "Nessun recapito disponibile"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pazienteInCaricamento && !errorePaziente && <p role="status" className="text-sm text-blue-700">Caricamento paziente selezionato…</p>}
            {errorePaziente && (
              <div role="alert" className="text-sm text-rose-700">
                <p>{errorePaziente}</p>
                <button type="button" disabled={loading} onClick={() => setRicaricaPaziente((n) => n + 1)} className="mt-1 underline">Riprova a caricare il paziente</button>
              </div>
            )}
          </section>

          <fieldset disabled={loading || pazienteInCaricamento || !!errorePaziente} className="min-w-0 space-y-4 disabled:opacity-60">
            <legend className="sr-only">Dati del paziente e del trasporto</legend>

            {existingPazienteId && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">Anagrafica già registrata: i dati non sono modificabili da questo modulo. Per correggerli, apri la <a href="/pazienti" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Rubrica in una nuova scheda</a> e poi seleziona nuovamente il paziente.</p>}

            {/* SEZIONE 1: ANAGRAFICA PAZIENTE */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <User size={18} className="text-blue-600" />
                  <span>Anagrafica Paziente</span>
                </div>
                {existingPazienteId && (
                  <span className="text-[11px] font-semibold text-slate-400">ID: {existingPazienteId.slice(0, 8)}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="nome"
                    readOnly={!!existingPazienteId}
                    value={formData.nome}
                    onChange={handleChange}
                    placeholder="Es. Mario"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cognome <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="cognome"
                    readOnly={!!existingPazienteId}
                    value={formData.cognome}
                    onChange={handleChange}
                    placeholder="Es. Rossi"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                    <Phone size={13} className="text-emerald-600" />
                    <span>Cellulare / WhatsApp <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    readOnly={!!existingPazienteId}
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="Es. 340 1234567"
                    className="w-full text-sm bg-emerald-50/40 border border-emerald-300 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none transition font-medium"
                    required
                  />
                </div>

                <details className="sm:col-span-2 md:col-span-3 rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">Dati anagrafici aggiuntivi e condizioni cliniche</summary>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Codice Fiscale</label>
                      <input
                        type="text"
                        name="codice_fiscale"
                        value={formData.codice_fiscale}
                        onChange={(e) => {
                          const input = e.currentTarget;
                          const { value, selectionStart, selectionEnd } = input;
                          const normalize = (text: string) => text.replace(/\s/g, "").toUpperCase();
                          input.value = normalize(value);
                          handleChange(e);
                          if (selectionStart !== null && selectionEnd !== null) {
                            input.setSelectionRange(
                              normalize(value.slice(0, selectionStart)).length,
                              normalize(value.slice(0, selectionEnd)).length,
                            );
                          }
                        }}
                        readOnly={!!existingPazienteId}
                        aria-describedby={existingPazienteId ? "codice-fiscale-help" : undefined}
                        placeholder="16 caratteri"
                        className="w-full text-sm uppercase font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      />
                      {existingPazienteId && (
                        <p id="codice-fiscale-help" className="mt-1 text-xs text-slate-500">
                          Per modificare il codice fiscale, apri la scheda paziente.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Data di Nascita</label>
                      <input
                        type="date"
                        name="data_nascita"
                    readOnly={!!existingPazienteId}
                        value={formData.data_nascita}
                        onChange={handleChange}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Luogo di Nascita</label>
                      <input
                        type="text"
                        name="luogo_nascita"
                    readOnly={!!existingPazienteId}
                        value={formData.luogo_nascita}
                        onChange={handleChange}
                        placeholder="Comune o Stato"
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      />
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Indirizzo di Residenza</label>
                      <input
                        type="text"
                        name="residenza"
                    readOnly={!!existingPazienteId}
                        value={formData.residenza}
                        onChange={handleChange}
                        placeholder="Via, Civico, Città, CAP"
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      />
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Condizioni Cliniche / Note Sanitarie</label>
                      <textarea
                        name="patologia"
                    readOnly={!!existingPazienteId}
                        rows={2}
                        value={formData.patologia}
                        onChange={handleChange}
                        placeholder="Deambulante, sedia a rotelle, allettato, dialisi..."
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition resize-none"
                      />
                    </div>
                  </div>
                </details>
              </div>
              {(duplicatiCF.length > 0 || possibiliDuplicati.length > 0) && (
                <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p>{duplicatiCF.length > 0
                    ? "Questo codice fiscale è già in rubrica. Seleziona il paziente esistente per evitare un duplicato."
                    : "Esistono pazienti con lo stesso nome e cognome. Verifica i dati prima di creare una nuova anagrafica."}</p>
                  <ul className="mt-2 space-y-2">
                    {(duplicatiCF.length > 0 ? duplicatiCF : possibiliDuplicati).map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => selezionaPaziente(p.id)} className="text-left font-semibold underline">
                          Usa {p.nome} {p.cognome} — {[p.data_nascita, p.telefono, p.codice_fiscale].filter(Boolean).join(" · ")}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <section className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 space-y-2" aria-labelledby="autista-titolo">
              <h2 id="autista-titolo" className="font-bold text-blue-950">2. Assegna l’autista</h2>
                <div>
                  <label htmlFor="autista-prenotazione" className="block text-xs font-semibold text-slate-600 mb-1">Autista (facoltativo)</label>
                  <select
                    id="autista-prenotazione"
                    disabled={loadingAutisti || !!erroreAutisti}
                    aria-describedby="autista-stato"
                    name="autista_id"
                    value={formData.autista_id}
                    onChange={handleChange}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  >
                    <option value="">-- Assegna in seguito --</option>
                    {autisti.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome} {a.cognome}
                      </option>
                    ))}
                  </select>
                </div>
              <p id="autista-stato" role="status" className="text-xs text-blue-900">
                {loadingAutisti ? "Caricamento autisti…" : erroreAutisti || (autisti.length === 0
                  ? "Nessun autista attivo nell’elenco. Puoi assegnarlo in seguito."
                  : "Elenco degli autisti attivi; la disponibilità oraria non viene verificata.")}
              </p>
              {erroreAutisti && <button type="button" onClick={() => setRicaricaAutisti((n) => n + 1)} className="text-xs text-blue-700 underline">Riprova</button>}
            </section>

            {/* SEZIONE 2: PIANIFICAZIONE & EQUIPAGGIO */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                <CalendarDays size={18} className="text-blue-600" />
                <span>3. Data, ora e richieste sanitarie</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Data Servizio <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    name="data_appuntamento"
                    value={formData.data_appuntamento}
                    onChange={handleChange}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Orario Convocazione <span className="text-rose-500">*</span></label>
                  <input
                    type="time"
                    name="ora_appuntamento"
                    value={formData.ora_appuntamento}
                    onChange={handleChange}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    required
                  />
                </div>


              </div>

              {/* Presidi Sanitari */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-600 mb-2">Presidi Sanitari Richiesti</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    formData.serve_ossigeno ? "bg-blue-50/70 border-blue-400 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}>
                    <input
                      type="checkbox"
                      name="serve_ossigeno"
                      checked={formData.serve_ossigeno}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Wind size={16} className="text-blue-500" />
                      <span>Bombola Ossigeno Necessaria</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    formData.serve_medico ? "bg-blue-50/70 border-blue-400 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}>
                    <input
                      type="checkbox"
                      name="serve_medico"
                      checked={formData.serve_medico}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Stethoscope size={16} className="text-blue-500" />
                      <span>Medico / Infermiere a bordo</span>
                    </div>
                  </label>
                </div>
              </div>

              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">Note operative per il trasporto</summary>
                <label className="mt-3 block text-xs font-semibold text-slate-600 mb-1">Istruzioni per l’equipaggio</label>
                <textarea
                  name="note"
                  rows={2}
                  value={formData.note}
                  onChange={handleChange}
                  placeholder="Istruzioni cancello, presenza accompagnatore, bagagli..."
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition resize-none"
                />
              </details>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* SEZIONE 3: PARTENZA */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                  <MapPin size={18} className="text-blue-600" />
                  <span>4. Partenza</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Città <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="partenza_citta"
                      value={formData.partenza_citta}
                      onChange={handleChange}
                      placeholder="Es. Roma"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Via / Piazza <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="partenza_via"
                      value={formData.partenza_via}
                      onChange={handleChange}
                      placeholder="Es. Via Appia Nuova"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Civico</label>
                    <input
                      type="text"
                      name="partenza_civico"
                      value={formData.partenza_civico}
                      onChange={handleChange}
                      placeholder="Es. 12"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    />
                  </div>

                  <details className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">Accesso e dettagli del ritiro</summary>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Piano</label>
                        <input
                          type="text"
                          name="partenza_piano"
                          value={formData.partenza_piano}
                          onChange={handleChange}
                          placeholder="Es. 2°"
                          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Interno / Scala</label>
                        <input
                          type="text"
                          name="partenza_interno"
                          value={formData.partenza_interno}
                          onChange={handleChange}
                          placeholder="Es. Scala A"
                          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                        />
                      </div>

                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            name="partenza_ascensore"
                            checked={formData.partenza_ascensore}
                            onChange={handleChange}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>Ascensore Presente</span>
                        </label>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Se Ospedale / Struttura</label>
                        <input
                          type="text"
                          name="partenza_dettagli_ospedale"
                          value={formData.partenza_dettagli_ospedale}
                          onChange={handleChange}
                          placeholder="Es. Reparto Dialisi, Padiglione A, Stanza 4"
                          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                        />
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* SEZIONE 4: ARRIVO */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                  <Building size={18} className="text-emerald-600" />
                  <span>Destinazione</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Città di Arrivo <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="arrivo_citta"
                      value={formData.arrivo_citta}
                      onChange={handleChange}
                      placeholder="Es. Roma"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Via / Piazza <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="arrivo_via"
                      value={formData.arrivo_via}
                      onChange={handleChange}
                      placeholder="Es. Via Casilina"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Civico</label>
                    <input
                      type="text"
                      name="arrivo_civico"
                      value={formData.arrivo_civico}
                      onChange={handleChange}
                      placeholder="Es. 1040"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    />
                  </div>

                  <details className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
                    <summary className="mb-3 cursor-pointer text-sm font-semibold text-slate-700">Dettagli della destinazione</summary>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Se Ospedale / Struttura</label>
                    <input
                      type="text"
                      name="arrivo_dettagli_ospedale"
                      value={formData.arrivo_dettagli_ospedale}
                      onChange={handleChange}
                      placeholder="Es. Policlinico Casilino, Ambulatorio 3"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    />
                  </details>
                </div>
              </div>

            </div>

            {/* SEZIONE 5: CONDIZIONI ECONOMICHE */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                <CreditCard size={18} className="text-blue-600" />
                <span>5. Condizioni economiche</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Costo Base (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="costo"
                    value={formData.costo}
                    onChange={handleChange}
                    placeholder="Es. 100"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="ore-incluse" className="block text-xs font-semibold text-slate-600 mb-1">Ore incluse</label>
                  <input
                    id="ore-incluse"
                    type="number"
                    step="any"
                    name="ore_incluse"
                    value={formData.ore_incluse}
                    onChange={handleChange}
                    placeholder="Es. 2,5"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="costo-ora-supplementare" className="block text-xs font-semibold text-slate-600 mb-1">Costo ora supplementare (€)</label>
                  <input
                    id="costo-ora-supplementare"
                    type="number"
                    step="0.01"
                    name="costo_ora_supplementare"
                    value={formData.costo_ora_supplementare}
                    onChange={handleChange}
                    placeholder="Es. 30"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Metodo di pagamento previsto</label>
                  <select
                    name="metodo_pagamento"
                    value={formData.metodo_pagamento}
                    onChange={handleChange}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition cursor-pointer font-medium"
                  >
                    <option value="Contanti">Contanti</option>
                    <option value="Bancomat">Bancomat</option>
                    <option value="Carta">Carta</option>
                    <option value="Bonifico istantaneo">Bonifico istantaneo</option>
                  </select>
                </div>

                <div className="sm:col-span-2 md:col-span-2 pt-5">
                  <label className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition ${
                    formData.pagato ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}>
                    <input
                      type="checkbox"
                      name="pagato"
                      checked={formData.pagato}
                      onChange={handleChange}
                      aria-describedby="pagamento-ricevuto-help"
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      Pagamento già ricevuto
                    </span>
                  </label>
                  <p id="pagamento-ricevuto-help" className="mt-2 text-xs text-slate-600">
                    Seleziona solo se hai già ricevuto il pagamento. Il metodo previsto non conferma l’incasso.
                  </p>
                </div>
              </div>
            </div>

            <section aria-labelledby="riepilogo-titolo" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h2 id="riepilogo-titolo" className="font-bold text-slate-900">6. Riepilogo e conferma</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-slate-500">Paziente</dt><dd className="font-semibold">{[formData.nome, formData.cognome].filter(Boolean).join(" ") || "Da inserire"} {existingPazienteId ? "· In rubrica" : "· Nuova anagrafica"}</dd></div>
                <div><dt className="text-xs text-slate-500">Autista</dt><dd className="font-semibold">{autistaSelezionato ? `${autistaSelezionato.nome} ${autistaSelezionato.cognome}` : "Da assegnare in seguito"}</dd></div>
                <div><dt className="text-xs text-slate-500">Data e ora</dt><dd>{formData.data_appuntamento ? new Date(formData.data_appuntamento + "T00:00:00").toLocaleDateString("it-IT") : "Data da inserire"} · {formData.ora_appuntamento || "Ora da inserire"}</dd></div>
                <div><dt className="text-xs text-slate-500">Richieste sanitarie</dt><dd>{[formData.serve_ossigeno && "Ossigeno", formData.serve_medico && "Medico / Infermiere"].filter(Boolean).join(" · ") || "Nessuna richiesta aggiuntiva"}</dd></div>
                <div><dt className="text-xs text-slate-500">Partenza</dt><dd>{[formData.partenza_via, formData.partenza_civico, formData.partenza_citta].filter(Boolean).join(", ") || "Da inserire"}</dd></div>
                <div><dt className="text-xs text-slate-500">Destinazione</dt><dd>{[formData.arrivo_via, formData.arrivo_civico, formData.arrivo_citta].filter(Boolean).join(", ") || "Da inserire"}</dd></div>
                <div><dt className="text-xs text-slate-500">Costo base</dt><dd>{formData.costo === "" ? "Non indicato" : `${formData.costo} €`}</dd></div>
                <div><dt className="text-xs text-slate-500">Ore incluse</dt><dd>{formData.ore_incluse === "" ? "Non indicate" : formData.ore_incluse}</dd></div>
                <div><dt className="text-xs text-slate-500">Costo ora supplementare</dt><dd>{formData.costo_ora_supplementare === "" ? "Non indicato" : `${formData.costo_ora_supplementare} €`}</dd></div>
                <div><dt className="text-xs text-slate-500">Metodo di pagamento previsto</dt><dd>{formData.metodo_pagamento}</dd></div>
                <div><dt className="text-xs text-slate-500">Stato del pagamento</dt><dd className={formData.pagato ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>{formData.pagato ? "Incassato" : "Da incassare"}</dd></div>
              </dl>
              <p className="text-xs text-slate-500">I campi numerici non compilati vengono salvati come 0.</p>
              <p className="text-xs text-slate-500">Dopo il salvataggio si apre WhatsApp con il messaggio di conferma da inviare.</p>
            </section>

            {/* PULSANTE SUBMIT */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || duplicatiCF.length > 0 || (!existingPazienteId && loadingArchivio)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-xl font-bold text-sm tracking-wide transition shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Salvataggio e Invio WhatsApp in corso...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={18} />
                    <span>Conferma e Invia WhatsApp al Cliente</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

          </fieldset>
        </form>

    </div>
  );
}

export default function PrenotazionePage() {
  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <Suspense fallback={
        <div className="flex justify-center items-center py-24 text-slate-400">
          <Loader2 className="animate-spin text-blue-600" size={36} />
        </div>
      }>
        <PrenotazioneFormContent />
      </Suspense>
    </div>
  );
}
