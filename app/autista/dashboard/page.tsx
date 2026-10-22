"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import { Play, StopCircle, LogOut, MapPin, Clock, AlertCircle } from 'lucide-react';

export default function AutistaDashboard() {
  const [corse, setCorse] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeAutista, setNomeAutista] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // SICUREZZA: Se non c'è un ID nel localStorage, l'autista non può entrare
    const autistaId = localStorage.getItem('autista_id');
    const nome = localStorage.getItem('autista_nome');
    
    if (!autistaId) {
      router.push('/autista');
      return;
    }

    setNomeAutista(nome || 'Autista');
    fetchMieCorse(autistaId);
  }, [router]);

  async function fetchMieCorse(id: string) {
    try {
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from('prenotazioni')
        .select(`*, pazienti(nome, cognome)`)
        .eq('autista_id', id)
        .order('data_appuntamento', { ascending: true })
        .order('ora_appuntamento', { ascending: true });

      if (dbError) throw dbError;
      setCorse(data || []);
      setError(null);
    } catch (err: any) {
      setError("Errore nel caricamento delle corse.");
    } finally {
      setLoading(false);
    }
  }

  async function registraOra(id: string, tipo: 'inizio' | 'fine') {
    const oraAttuale = new Date().toISOString();
    const colonna = tipo === 'inizio' ? 'ora_inizio_effettiva' : 'ora_fine_effettiva';

    const { error: dbError } = await supabase
      .from('prenotazioni')
      .update({ [colonna]: oraAttuale })
      .eq('id', id);

    if (dbError) alert("Errore nel registrare l'orario");
    else {
      const autistaId = localStorage.getItem('autista_id')!;
      fetchMieCorse(autistaId);
    }
  }

  function logout() {
    localStorage.clear();
    router.push('/autista');
  }

  if (loading) return <div className="min-h-screen flex justify-center items-center bg-gray-100 font-bold">Caricamento...</div>;

  if (error) return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 text-center">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <p className="text-red-600 font-bold">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg">Riprova</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <p className="text-gray-500 text-xs uppercase font-bold">Benvenuto</p>
            <h1 className="text-xl font-bold text-gray-800">Ciao, {nomeAutista}! 👋</h1>
          </div>
          <button onClick={logout} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition">
            <LogOut size={24} />
          </button>
        </div>

        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Clock size={20} /> Le tue corse assegnate
        </h2>

        <div className="space-y-4">
          {corse.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl text-center text-gray-500 shadow-sm">
              Nessuna corsa assegnata.
            </div>
          ) : (
            corse.map(corsa => {
              const haIniziato = !!corsa.ora_inizio_effettiva;
              const haFinito = !!corsa.ora_fine_effettiva;

              return (
                <div key={corsa.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-blue-600 font-black text-xl">{corsa.ora_appuntamento}</div>
                      <div className="font-bold text-gray-800 text-lg">
                        {corsa.pazienti?.nome} {corsa.pazienti?.cognome}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400 font-medium">
                      {new Date(corsa.data_appuntamento).toLocaleDateString('it-IT')}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl flex items-center gap-2 text-gray-600 text-sm">
                    <MapPin size={16} /> 
                    <span>{corsa.partenza_citta} ➡️ {corsa.arrivo_citta}</span>
                  </div>

                  <div className="flex gap-3">
                    {!haIniziato ? (
                      <button onClick={() => registraOra(corsa.id, 'inizio')} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition">
                        <Play size={20} /> Inizia Corsa
                      </button>
                    ) : !haFinito ? (
                      <button onClick={() => registraOra(corsa.id, 'fine')} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition">
                        <StopCircle size={20} /> Termina Corsa
                      </button>
                    ) : (
                      <div className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold text-center border border-gray-200">
                        Completata ✅
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}