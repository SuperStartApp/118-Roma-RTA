"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { Search, Filter, Calendar, User, Eye } from 'lucide-react';

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
  
  // STATI PER I FILTRI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAutista, setFilterAutista] = useState('');

  useEffect(() => {
    fetchAutisti();
    fetchPrenotazioni();
  }, []);

  // Effetto per ricaricare le corse ogni volta che un filtro cambia
  useEffect(() => {
    fetchPrenotazioni();
  }, [searchTerm, filterDate, filterAutista]);

  async function fetchAutisti() {
    const { data } = await supabase.from('autisti').select('id, nome, cognome').eq('attivo', true);
    setAutisti(data || []);
  }

  async function fetchPrenotazioni() {
    setLoading(true);
    try {
      let query = supabase
        .from('prenotazioni')
        .select(`*, pazienti(nome, cognome), autisti(nome, cognome)`)
        .order('data_appuntamento', { ascending: true });

      // FILTRO DATA
      if (filterDate) {
        query = query.eq('data_appuntamento', filterDate);
      }

      // FILTRO AUTISTA
      if (filterAutista) {
        query = query.eq('autista_id', filterAutista);
      }

      const { data, error } = await query;
      if (error) throw error;

      // FILTRO RICERCA (Nome/Cognome) - fatto lato client per velocità
      let filteredData = data || [];
      if (searchTerm) {
        filteredData = filteredData.filter(p => 
          p.pazienti?.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
          p.pazienti?.cognome.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setPrenotazioni(filteredData);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function togglePagamento(id: string, statoAttuale: boolean) {
    const { error } = await supabase.from('prenotazioni').update({ pagato: !statoAttuale }).eq('id', id);
    if (!error) fetchPrenotazioni();
  }

  if (loading) return <div className="flex justify-center items-center h-screen font-bold text-blue-600">Caricamento dati... 🚑</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">📂 Archivio Corse</h1>
          <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold">
            Trovate: {prenotazioni.length}
          </span>
        </div>

        {/* BARRA DEI FILTRI */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Cerca paziente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="relative">
            <User className="absolute left-3 top-3 text-gray-400" size={20} />
            <select 
              value={filterAutista}
              onChange={(e) => setFilterAutista(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Tutti gli Autisti</option>
              {autisti.map(a => (
                <option key={a.id} value={a.id}>{a.nome} {a.cognome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
              <tr>
                <th className="p-4">Data/Ora</th>
                <th className="p-4">Paziente</th>
                <th className="p-4">Autista</th>
                <th className="p-4">Costo</th>
                <th className="p-4 text-center">Pagamento</th>
                <th className="p-4 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prenotazioni.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-500">Nessuna corsa trovata con questi filtri.</td></tr>
              ) : (
                prenotazioni.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50 transition">
                    <td className="p-4 font-medium">
                      {new Date(p.data_appuntamento).toLocaleDateString('it-IT')} <br/>
                      <span className="text-gray-400 text-xs">{p.ora_appuntamento}</span>
                    </td>
                    <td className="p-4 font-bold text-blue-700">{p.pazienti?.nome} {p.pazienti?.cognome}</td>
                    <td className="p-4 text-gray-600">{p.autisti?.nome || 'Non assegnata'}</td>
                    <td className="p-4">{p.costo} €</td>
                    <td className="p-4 text-center">
                      {p.pagato ? 
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Pagato</span> : 
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Da Pagare</span>
                      }
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={() => togglePagamento(p.id, p.pagato)} className="text-xs p-2 rounded bg-gray-100 hover:bg-gray-200 transition">
                        {p.pagato ? 'Annulla' : 'Incassa'}
                      </button>
                      <Link href={`/prenotazioni/${p.id}`} className="p-2 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition">
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}