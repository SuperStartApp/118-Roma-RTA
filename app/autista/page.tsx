"use client";

import React, { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, KeyRound, ArrowLeft, Loader2, AlertCircle } from "lucide-react";

export default function AutistaLogin() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("autisti")
        .select("id, nome, cognome")
        .eq("pin", pin)
        .eq("attivo", true)
        .single();

      if (error || !data) {
        setErrorMessage("PIN non valido o operatore non abilitato.");
      } else {
        localStorage.setItem("autista_id", data.id);
        localStorage.setItem("autista_nome", `${data.nome} ${data.cognome || ""}`.trim());
        router.push("/autista/dashboard");
      }
    } catch (err) {
      setErrorMessage("Errore di connessione con la centrale operativa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      
      {/* Box Principale */}
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 text-center space-y-6">
        
        {/* Icona e Titolo */}
        <div>
          <div className="w-16 h-16 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <KeyRound size={28} strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Accesso Operativo Autisti
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Inserisci il tuo codice PIN a 6 cifre per avviare il turno
          </p>
        </div>

        {/* Notifica di Errore */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 text-left">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form PIN */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full text-center text-3xl font-mono tracking-[0.4em] py-3.5 px-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide transition shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Verifica PIN...</span>
              </>
            ) : (
              <span>Entra nel Turno</span>
            )}
          </button>
        </form>

        {/* Link Torna alla Centrale */}
        <div className="pt-2 border-t border-slate-100">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            <ArrowLeft size={14} /> Torna al portale centrale
          </Link>
        </div>

      </div>
    </div>
  );
}