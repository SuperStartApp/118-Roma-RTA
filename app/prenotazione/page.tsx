"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function PrenotazionePage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [autisti, setAutisti] = useState<any[]>([]); // Stato per la lista autisti

  const [formData, setFormData] = useState({
    // Paziente
    nome: '', cognome: '', data_nascita: '', luogo_nascita: '', 
    codice_fiscale: '', residenza: '', peso_approssimativo: '', patologia: '',
    // Corsa
    data_appuntamento: '', ora_appuntamento: '', 
    serve_ossigeno: false, serve_medico: false, note: '',
    // Partenza
    partenza_citta: '', partenza_via: '', partenza_civico: '', 
    partenza_piano: '', partenza_interno: '', partenza_ascensore: true, 
    partenza_dettagli_ospedale: '',
    // Arrivo
    arrivo_citta: '', arrivo_via: '', arrivo_civico: '', 
    arrivo_piano: '', arrivo_interno: '', arrivo_ascensore: true, 
    arrivo_dettagli_ospedale: '',
    // Pagamento, Ore e Assegnazione
    costo: '', ore_incluse: '', costo_ora_supplementare: '', 
    metodo_pagamento: 'Contanti', pagato: false,
    autista_id: '' // Nuovo campo per l'ID dell'autista
  });

  // CARICAMENTO AUTISTI all'avvio della pagina
  useEffect(() => {
    async function loadAutisti() {
      const { data } = await supabase.from('autisti').select('id, nome, cognome').eq('attivo', true);
      if (data) setAutisti(data);
    }
    loadAutisti();
  }, []);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // 1. Salviamo il paziente
      const { data: paziente, error: pError } = await supabase
        .from('pazienti')
        .insert([{ 
          nome: formData.nome, 
          cognome: formData.cognome, 
          data_nascita: formData.data_nascita,
          luogo_nascita: formData.luogo_nascita,
          codice_fiscale: formData.codice_fiscale,
          residenza: formData.residenza,
          peso_approssimativo: formData.peso_approssimativo,
          patologia: formData.patologia
        }])
        .select()
        .single();

      if (pError) throw pError;

      // 2. Salviamo la prenotazione collegandola al paziente E all'autista
      const { error: rError } = await supabase
        .from('prenotazioni')
        .insert([{
          paziente_id: paziente.id,
          autista_id: formData.autista_id, // <--- AGGIUNTO QUI
          data_appuntamento: formData.data_appuntamento,
          ora_appuntamento: formData.ora_appuntamento,
          serve_ossigeno: formData.serve_ossigeno,
          serve_medico: formData.serve_medico,
          note: formData.note,
          partenza_citta: formData.partenza_citta,
          partenza_via: formData.partenza_via,
          partenza_civico: formData.partenza_civico,
          partenza_piano: formData.partenza_piano,
          partenza_interno: formData.partenza_interno,
          partenza_ascensore: formData.partenza_ascensore,
          partenza_dettagli_ospedale: formData.partenza_dettagli_ospedale,
          arrivo_citta: formData.arrivo_citta,
          arrivo_via: formData.arrivo_via,
          arrivo_civico: formData.arrivo_civico,
          arrivo_piano: formData.arrivo_piano,
          arrivo_interno: formData.arrivo_interno,
          arrivo_ascensore: formData.arrivo_ascensore,
          arrivo_dettagli_ospedale: formData.arrivo_dettagli_ospedale,
          costo: parseFloat(formData.costo),
          ore_incluse: parseFloat(formData.ore_incluse),
          costo_ora_supplementare: parseFloat(formData.costo_ora_supplementare),
          metodo_pagamento: formData.metodo_pagamento,
          pagato: formData.pagato
        }]);

      if (rError) throw rError;

      setMessage("✅ Prenotazione assegnata e salvata con successo!");
    } catch (error: any) {
      setMessage("❌ Errore: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="bg-blue-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold">🚑 Nuova Prenotazione Trasporto</h1>
          <p className="opacity-80">Inserisci i dati del cliente e assegna l'autista</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* SEZIONE 1: DATI PAZIENTE */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-4 border-b pb-2">👤 Dati Paziente</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" name="nome" placeholder="Nome" onChange={handleChange} className="border p-2 rounded" required />
              <input type="text" name="cognome" placeholder="Cognome" onChange={handleChange} className="border p-2 rounded" required />
              <input type="date" name="data_nascita" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="luogo_nascita" placeholder="Luogo di Nascita" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="codice_fiscale" placeholder="Codice Fiscale" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="residenza" placeholder="Residenza (per ricevuta)" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="peso_approssimativo" placeholder="Peso Approssimativo" onChange={handleChange} className="border p-2 rounded" />
              <textarea name="patologia" placeholder="Patologia" onChange={handleChange} className="border p-2 rounded md:col-span-2" />
            </div>
          </section>

          {/* SEZIONE 2: DETTAGLI CORSA E ASSEGNAZIONE */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-4 border-b pb-2">📅 Dettagli e Assegnazione</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">Data</label>
                <input type="date" name="data_appuntamento" onChange={handleChange} className="border p-2 rounded" required />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">Ora</label>
                <input type="time" name="ora_appuntamento" onChange={handleChange} className="border p-2 rounded" required />
              </div>
              
              {/* SELEZIONE AUTISTA */}
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">Assegna Autista</label>
                <select name="autista_id" onChange={handleChange} className="border p-2 rounded bg-white" required>
                  <option value="">-- Seleziona Autista --</option>
                  {autisti.map(a => (
                    <option key={a.id} value={a.id}>{a.nome} {a.cognome}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-4 pt-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" name="serve_ossigeno" onChange={handleChange} className="w-4 h-4" />
                  <span>Ossigeno</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" name="serve_medico" onChange={handleChange} className="w-4 h-4" />
                  <span>Medico</span>
                </label>
              </div>
              <textarea name="note" placeholder="Note aggiuntive" onChange={handleChange} className="border p-2 rounded md:col-span-3" />
            </div>
          </section>

          {/* SEZIONE 3: LOGISTICA PARTENZA */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-4 border-b pb-2">🛫 Partenza</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input type="text" name="partenza_citta" placeholder="Città" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="partenza_via" placeholder="Via" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="partenza_civico" placeholder="Civico" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="partenza_piano" placeholder="Piano" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="partenza_interno" placeholder="Interno" onChange={handleChange} className="border p-2 rounded" />
              <div className="flex items-center space-x-2">
                <input type="checkbox" name="partenza_ascensore" checked={formData.partenza_ascensore} onChange={handleChange} className="w-4 h-4" />
                <span>C'è ascensore?</span>
              </div>
              <input type="text" name="partenza_dettagli_ospedale" placeholder="Se Ospedale: Reparto, Stanza, Letto" onChange={handleChange} className="border p-2 rounded md:col-span-2" />
            </div>
          </section>

          {/* SEZIONE 4: LOGISTICA ARRIVO */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-4 border-b pb-2">🛬 Arrivo</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input type="text" name="arrivo_citta" placeholder="Città" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="arrivo_via" placeholder="Via" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="arrivo_civico" placeholder="Civico" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="arrivo_piano" placeholder="Piano" onChange={handleChange} className="border p-2 rounded" />
              <input type="text" name="arrivo_interno" placeholder="Interno" onChange={handleChange} className="border p-2 rounded" />
              <div className="flex items-center space-x-2">
                <input type="checkbox" name="arrivo_ascensore" checked={formData.arrivo_ascensore} onChange={handleChange} className="w-4 h-4" />
                <span>C'è ascensore?</span>
              </div>
              <input type="text" name="arrivo_dettagli_ospedale" placeholder="Se Ospedale: Reparto, Stanza, Letto" onChange={handleChange} className="border p-2 rounded md:col-span-2" />
            </div>
          </section>

          {/* SEZIONE 5: PAGAMENTO E TEMPI */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-4 border-b pb-2">💰 Pagamento e Tempi</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 ml-1">Costo Base (€)</label>
                <input type="number" name="costo" placeholder="Es: 100" onChange={handleChange} className="border p-2 rounded" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 ml-1">Ore Incluse</label>
                <input type="number" name="ore_incluse" placeholder="Es: 2" onChange={handleChange} className="border p-2 rounded" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 ml-1">Costo Ora Extra (€)</label>
                <input type="number" name="costo_ora_supplementare" placeholder="Es: 30" onChange={handleChange} className="border p-2 rounded" />
              </div>
              <select name="metodo_pagamento" onChange={handleChange} className="border p-2 rounded bg-white md:col-span-2">
                <option value="Contanti">Contanti</option>
                <option value="Bancomat">Bancomat</option>
                <option value="Bonifico Istantaneo">Bonifico Istantaneo</option>
              </select>
              <div className="flex items-center space-x-2">
                <input type="checkbox" name="pagato" onChange={handleChange} className="w-4 h-4" />
                <span>Già Pagato?</span>
              </div>
            </div>
          </section>

          {message && (
            <div className={`p-4 rounded-lg text-center font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? "Salvataggio in corso..." : "💾 Salva e Assegna Corsa"}
          </button>
        </form>
      </div>
    </div>
  );
}