"use client";
import React, { useEffect, useState, Suspense } from 'react'; // Aggiunto Suspense
import { supabase } from '@/app/lib/supabase';
import { useParams } from 'next/navigation';
import { ArrowLeft, User, MapPin, Activity, CreditCard, Clock, Timer } from 'lucide-react';
import Link from 'next/link';

// 1. CREIAMO UN COMPONENTE SEPARATO PER IL CONTENUTO
function CorsaDetailContent() {
  const params = useParams();
  const [corsa, setCorsa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDettagli() {
      if (!params || !params.id) return;
      try {
        const { data, error } = await supabase
          .from('prenotazioni')
          .select(`*, pazienti(*)`)
          .eq('id', params.id)
          .single();
        if (error) throw error;
        setCorsa(data);
      } catch (error: any) {
        console.error("Errore:", error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDettagli();
  }, [params]);

  const calcolaDurata = () => {
    if (!corsa?.ora_inizio_effettiva || !corsa?.ora_fine_effettiva) return null;
    const inizio = new Date(corsa.ora_inizio_effettiva);
    const fine = new Date(corsa.ora_fine_effettiva);
    const diffMs = fine.getTime() - inizio.getTime();
    if (diffMs < 0) return "Errore";
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h ${diffMins}m`;
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center font-bold text-blue-600">Caricamento dettagli... 🚑</div>;
  if (!corsa) return <div className="min-h-screen flex justify-center items-center font-bold text-red-500">Corsa non trovata.</div>;

  return (
    <div className="bg-white shadow-xl rounded-3xl overflow-hidden border border-gray-200">
      <div className="bg-blue-600 p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{corsa.pazienti?.nome} {corsa.pazienti?.cognome}</h1>
            <p className="opacity-80">{new Date(corsa.data_appuntamento).toLocaleDateString('it-IT')} ore {corsa.ora_appuntamento}</p>
          </div>
          <div className="bg-white text-blue-600 px-4 py-2 rounded-full font-black text-sm">ID: {corsa.id?.slice(0, 8)}</div>
        </div>
      </div>
      <div className="p-6 space-y-8">
        <section className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-200">
          <div className="flex items-center gap-2 text-blue-700 font-bold mb-4"><Timer size={24} /> <span>Monitoraggio Tempo Reale</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-white p-3 rounded-xl shadow-sm">
              <p className="text-xs text-gray-400 uppercase font-bold">Inizio</p>
              <p className="text-lg font-bold">{corsa.ora_inizio_effettiva ? new Date(corsa.ora_inizio_effettiva).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '---'}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm">
              <p className="text-xs text-gray-400 uppercase font-bold">Fine</p>
              <p className="text-lg font-bold">{corsa.ora_fine_effettiva ? new Date(corsa.ora_fine_effettiva).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '---'}</p>
            </div>
            <div className="bg-blue-600 p-3 rounded-xl shadow-sm text-white">
              <p className="text-xs opacity-80 uppercase font-bold">Durata</p>
              <p className="text-2xl font-black">{calcolaDurata() || '--:--'}</p>
            </div>
          </div>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
          <div className="flex items-start space-x-3">
            <User className="text-blue-500 mt-1" size={24} />
            <div><p className="text-xs text-gray-400 uppercase font-bold">Anagrafica</p><p className="text-gray-700">CF: {corsa.pazienti?.codice_fiscale}</p></div>
          </div>
          <div className="flex items-start space-x-3">
            <Activity className="text-red-500 mt-1" size={24} />
            <div><p className="text-xs text-gray-400 uppercase font-bold">Medica</p><p className="text-gray-700">{corsa.patologia || "Nessuna"}</p></div>
          </div>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-6">
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center space-x-2 text-blue-700 font-bold mb-2"><MapPin size={20} /> <span>PARTENZA</span></div>
            <p className="font-bold">{corsa.partenza_via}, {corsa.partenza_civico}</p>
            <p>{corsa.partenza_citta}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center space-x-2 text-green-700 font-bold mb-2"><MapPin size={20} /> <span>ARRIVO</span></div>
            <p className="font-bold">{corsa.arrivo_via}, {corsa.arrivo_civico}</p>
            <p>{corsa.arrivo_citta}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

// 2. QUESTA È LA PAGINA CHE NEXT.JS VEDE PER PRIMA
export default function DettaglioCorsaPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/prenotazioni" className="flex items-center text-blue-600 mb-6 hover:underline font-medium">
          <ArrowLeft size={20} className="mr-2" /> Torna alla lista
        </Link>
        {/* Avvolgiamo il contenuto in Suspense per eliminare l'errore di URL data */}
        <Suspense fallback={<div className="text-center p-10 font-bold text-blue-600">Sincronizzazione dati... 🚑</div>}>
          <CorsaDetailContent />
        </Suspense>
      </div>
    </div>
  );
}