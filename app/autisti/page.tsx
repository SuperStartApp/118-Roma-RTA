"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { UserPlus, UserX, Phone, Key } from 'lucide-react';

export default function GestioneAutisti() {
  const [autisti, setAutisti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');

  useEffect(() => {
    fetchAutisti();
  }, []);

  async function fetchAutisti() {
    setLoading(true);
    const { data } = await supabase.from('autisti').select('*').eq('attivo', true);
    setAutisti(data || []);
    setLoading(false);
  }

  async function aggiungiAutista(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('autisti').insert([{ nome, cognome, telefono, pin }]);
    if (error) alert("Errore: " + error.message);
    else {
      setNome(''); setCognome(''); setTelefono(''); setPin('');
      fetchAutisti();
    }
  }

  async function eliminaAutista(id: string) {
    if (confirm("Sei sicuro di voler rimuovere questo autista?")) {
      await supabase.from('autisti').update({ attivo: false }).eq('id', id);
      fetchAutisti();
    }
  }

  if (loading) return <div className="p-10 text-center">Caricamento autisti...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
          👥 Gestione Staff Autisti
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORM AGGIUNTA */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 h-fit">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <UserPlus className="text-blue-600" /> Nuovo Autista
            </h2>
            <form onSubmit={aggiungiAutista} className="space-y-4">
              <input type="text" placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} className="w-full border p-3 rounded-xl" required />
              <input type="text" placeholder="Cognome" value={cognome} onChange={e => setCognome(e.target.value)} className="w-full border p-3 rounded-xl" required />
              <input type="text" placeholder="Telefono" value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full border p-3 rounded-xl" />
              <div className="relative">
                <Key className="absolute left-3 top-3 text-gray-400" size={20} />
                <input type="text" placeholder="PIN (6 cifre)" value={pin} onChange={e => setPin(e.target.value)} className="w-full border p-3 pl-10 rounded-xl" maxLength={6} required />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
                Crea Autista
              </button>
            </form>
          </div>

          {/* LISTA AUTISTI */}
          <div className="lg:col-span-2 space-y-4">
            {autisti.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl text-center text-gray-500 border border-dashed border-gray-300">
                Nessun autista registrato.
              </div>
            ) : (
              autisti.map(a => (
                <div key={a.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">
                      {a.nome[0]}{a.cognome[0]}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 text-lg">{a.nome} {a.cognome}</div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Phone size={14} /> {a.telefono}</span>
                        <span className="flex items-center gap-1"><Key size={14} /> PIN: {a.pin}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => eliminaAutista(a.id)} className="p-2 text-red-400 hover:text-red-600 transition">
                    <UserX size={24} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}