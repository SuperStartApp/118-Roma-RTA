"use client";
import React, { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function AutistaLogin() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Cerchiamo l'autista che ha questo PIN e che è attivo
      const { data, error } = await supabase
        .from('autisti')
        .select('id, nome')
        .eq('pin', pin)
        .eq('attivo', true)
        .single();

      if (error || !data) {
        alert("PIN errato o utente non attivo!");
      } else {
        // SALVATAGGIO: Memorizziamo l'ID dell'autista per non farlo loggare ogni volta
        localStorage.setItem('autista_id', data.id);
        localStorage.setItem('autista_nome', data.nome);
        
        // REINDIRIZZAMENTO: Mandiamolo alla dashboard
        router.push('/autista/dashboard');
      }
    } catch (err) {
      alert("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
        <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="text-blue-600" size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Area Autisti</h1>
        <p className="text-gray-500 mb-8">Inserisci il tuo PIN a 6 cifre per accedere</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <input 
            type="text" 
            placeholder="000000" 
            value={pin} 
            onChange={e => setPin(e.target.value)} 
            className="w-full text-center text-4xl tracking-widest border-2 border-gray-200 p-4 rounded-2xl focus:border-blue-500 outline-none transition"
            maxLength={6}
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-xl hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? "Verifica..." : "Entra nel Turno"}
          </button>
        </form>
      </div>
    </div>
  );
}