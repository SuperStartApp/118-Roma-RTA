"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link'; // Importato per far funzionare il tasto Dettagli

interface CorsaOggi {
  id: string;
  ora_appuntamento: string;
  pazienti: { nome: string; cognome: string } | null;
  partenza_citta: string;
  arrivo_citta: string;
}

export default function AgendaGiornaliera() {
  const [corse, setCorse] = useState<CorsaOggi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCorseOggi();
  }, []);

  async function fetchCorseOggi() {
    setLoading(true);
    // Prende la data di oggi in formato YYYY-MM-DD
    const oggi = new Date().toISOString().split('T')[0]; 
    
    try {
      const { data, error } = await supabase
        .from('prenotazioni')
        .select(`*, pazienti(nome, cognome)`)
        .eq('data_appuntamento', oggi)
        .order('ora_appuntamento', { ascending: true });

      if (error) throw error;
      setCorse(data || []);
    } catch (error: any) {
      console.error("Errore nel caricamento agenda:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex justify-center items-center h-screen font-bold text-blue-600">Caricamento agenda... 🚑</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-4xl">📅</span> Agenda di Oggi
          </h1>
          <div className="text-right">
            <p className="text-gray-500 font-medium">
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <span className="text-blue-600 font-bold">
              {corse.length} {corse.length === 1 ? 'corsa' : 'corse'} programmate
            </span>
          </div>
        </div>

        {/* LISTA CORSE */}
        {corse.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl shadow-sm text-center text-gray-500 border border-gray-100">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-xl font-medium">Nessuna corsa per oggi.</p>
            <p className="text-gray-400">Momento di relax per l'equipaggio!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {corse.map((corsa) => (
              <div 
                key={corsa.id} 
                className="bg-white p-5 rounded-2xl shadow-sm border-l-8 border-blue-500 flex items-center justify-between hover:shadow-md transition-all"
              >
                <div className="flex items-center space-x-6">
                  {/* Ora */}
                  <div className="text-2xl font-black text-blue-700 min-w-[100px]">
                    {corsa.ora_appuntamento}
                  </div>
                  
                  {/* Dati Paziente e Percorso */}
                  <div>
                    <div className="font-bold text-lg text-gray-800">
                      {corsa.pazienti?.nome} {corsa.pazienti?.cognome || 'Sconosciuto'}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <span>📍</span> {corsa.partenza_citta} <span className="mx-1">➡️</span> {corsa.arrivo_citta}
                    </div>
                  </div>
                </div>

                {/* BOTTONE DETTAGLI - Ora collegato correttamente */}
                <Link 
                  href={`/prenotazioni/${corsa.id}`} 
                  className="bg-gray-100 text-gray-600 px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 hover:text-white transition-colors"
                >
                  Dettagli
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}