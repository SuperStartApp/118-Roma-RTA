"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
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
  MessageSquare
} from "lucide-react";

export default function PrenotazionePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [autisti, setAutisti] = useState<any[]>([]);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);

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

  useEffect(() => {
    async function loadAutisti() {
      const { data } = await supabase
        .from("autisti")
        .select("id, nome, cognome")
        .eq("attivo", true)
        .order("cognome", { ascending: true });
      if (data) setAutisti(data);
    }
    loadAutisti();
  }, []);

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
`🚑 *CONFERMA PRENOTAZIONE TRASPORTO SANITARIO*

Gentile *${formData.nome.trim()} ${formData.cognome.trim()}*,
le confermiamo la prenotazione del servizio:

📅 *Data:* ${dataFormatted}
⏰ *Orario convocazione:* ore ${formData.ora_appuntamento}

📍 *Ritiro:* ${formData.partenza_via} ${formData.partenza_civico || ""}, ${formData.partenza_citta}
🏥 *Destinazione:* ${formData.arrivo_via} ${formData.arrivo_civico || ""}, ${formData.arrivo_citta}
${formData.costo ? `💶 *Importo convenuto:* ${formData.costo} €` : ""}

_Il nostro equipaggio sarà a vostra disposizione. Per variazioni urgenti potete contattare direttamente questo recapito._`;

    // Pulizia del numero telefonico (rimuove spazi, trattini e aggiunge il 39 se assente)
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
      // 1. Inserimento Paziente
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

      // 2. Inserimento Corsa
      const { error: rError } = await supabase.from("prenotazioni").insert([
        {
          paziente_id: paziente.id,
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
          metodo_pagamento: formData.metodo_pagamento,
          pagato: formData.pagato,
        },
      ]);

      if (rError) throw rError;

      // 3. Apertura immediata di WhatsApp se c'è un recapito telefonico
      if (formData.telefono.trim()) {
        const waLink = generaMessaggioWhatsApp();
        setWhatsAppUrl(waLink);
        window.open(waLink, "_blank");
      }

      setStatusMessage({
        type: "success",
        text: "Servizio registrato con successo nel sistema!",
      });

      // Reset modulo
      setFormData(initialFormState);
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
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* INTESTAZIONE */}
        <div className="pb-3 border-b border-slate-200">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <PlusCircle size={14} /> Accettazione & Dispacciamento
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nuovo Servizio di Trasporto Sanitario
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Inserisci i dati del paziente: al salvataggio partirà automaticamente la notifica WhatsApp di conferma.
          </p>
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

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SEZIONE 1: ANAGRAFICA PAZIENTE */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <User size={18} className="text-blue-600" />
              <span>Anagrafica Paziente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="nome"
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
                  value={formData.cognome}
                  onChange={handleChange}
                  placeholder="Es. Rossi"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  required
                />
              </div>

              {/* RECAPITO WHATSAPP */}
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                  <Phone size={13} className="text-emerald-600" />
                  <span>Cellulare / WhatsApp <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Es. 340 1234567"
                  className="w-full text-sm bg-emerald-50/40 border border-emerald-300 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none transition font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Codice Fiscale</label>
                <input
                  type="text"
                  name="codice_fiscale"
                  value={formData.codice_fiscale}
                  onChange={handleChange}
                  placeholder="16 caratteri alfanumerici"
                  className="w-full text-sm uppercase font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  maxLength={16}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data di Nascita</label>
                <input
                  type="date"
                  name="data_nascita"
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
                  rows={2}
                  value={formData.patologia}
                  onChange={handleChange}
                  placeholder="Es. Deambulante, sedia a rotelle, barellato, ossigenoterapia..."
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition resize-none"
                />
              </div>
            </div>
          </div>

          {/* SEZIONE 2: PIANIFICAZIONE & ASSEGNAZIONE EQUIPAGGIO */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <CalendarDays size={18} className="text-blue-600" />
              <span>Programmazione Corsa & Equipaggio</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Assegna Autista / Equipaggio</label>
                <select
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

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Note Operative per l'Equipaggio</label>
              <textarea
                name="note"
                rows={2}
                value={formData.note}
                onChange={handleChange}
                placeholder="Istruzioni cancello, presenza accompagnatore, bagagli..."
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition resize-none"
              />
            </div>
          </div>

          {/* SEZIONE 3: PARTENZA */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <MapPin size={18} className="text-blue-600" />
              <span>Punto di Prelievo (Partenza)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Città <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="partenza_citta"
                  value={formData.partenza_citta}
                  onChange={handleChange}
                  placeholder="Es. Milano"
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
                  placeholder="Es. Via Roma"
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

              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Se Struttura Sanitaria / Ospedale</label>
                <input
                  type="text"
                  name="partenza_dettagli_ospedale"
                  value={formData.partenza_dettagli_ospedale}
                  onChange={handleChange}
                  placeholder="Es. Reparto Dialisi, Piano 1, Stanza 4"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* SEZIONE 4: ARRIVO */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <Building size={18} className="text-emerald-600" />
              <span>Punto di Destinazione (Arrivo)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Città di Arrivo <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="arrivo_citta"
                  value={formData.arrivo_citta}
                  onChange={handleChange}
                  placeholder="Es. Pavia"
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
                  placeholder="Es. Viale Golgi"
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
                  placeholder="Es. 19"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Se Struttura Sanitaria / Ospedale</label>
                <input
                  type="text"
                  name="arrivo_dettagli_ospedale"
                  value={formData.arrivo_dettagli_ospedale}
                  onChange={handleChange}
                  placeholder="Es. Policlinico San Matteo, Ingresso Day Hospital"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* SEZIONE 5: CONDIZIONI ECONOMICHE */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <CreditCard size={18} className="text-blue-600" />
              <span>Condizioni Economiche & Saldo</span>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Metodo di Pagamento</label>
                <select
                  name="metodo_pagamento"
                  value={formData.metodo_pagamento}
                  onChange={handleChange}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                >
                  <option value="Contanti">Contanti</option>
                  <option value="Bancomat / POS">Bancomat / POS</option>
                  <option value="Bonifico Istantaneo">Bonifico Istantaneo</option>
                  <option value="Fattura Differita">Fattura Differita</option>
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
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {formData.pagato ? "Servizio Saldato" : "Da Saldare al Ritiro"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* PULSANTE SUBMIT */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
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
                  <span>Conferma, Assegna e Invia WhatsApp al Cliente</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}