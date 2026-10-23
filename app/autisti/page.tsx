"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { 
  UserPlus, 
  UserX, 
  Phone, 
  Key, 
  Users, 
  ShieldCheck, 
  Loader2,
  CheckCircle2
} from "lucide-react";

export default function GestioneAutisti() {
  const [autisti, setAutisti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    fetchAutisti();
  }, []);

  async function fetchAutisti() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("autisti")
        .select("*")
        .eq("attivo", true)
        .order("cognome", { ascending: true });

      if (error) throw error;
      setAutisti(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function aggiungiAutista(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("autisti").insert([
        { nome, cognome, telefono, pin, attivo: true },
      ]);
      if (error) throw error;

      setNome("");
      setCognome("");
      setTelefono("");
      setPin("");
      await fetchAutisti();
    } catch (error: any) {
      alert("Errore inserimento: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function eliminaAutista(id: string, nomeCompleto: string) {
    if (confirm(`Sei sicuro di voler disattivare l'autista ${nomeCompleto}?`)) {
      const { error } = await supabase
        .from("autisti")
        .update({ attivo: false })
        .eq("id", id);

      if (!error) fetchAutisti();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* INTESTAZIONE PAGINA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <Users size={14} /> Risorse Umane & Equipaggi
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestione Personale Operativo
            </h1>
          </div>
          <div>
            <span className="px-3 py-1 rounded-md text-xs font-semibold bg-slate-200 text-slate-800">
              {autisti.length} {autisti.length === 1 ? "autista attivo" : "autisti attivi"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* FORM NUOVO AUTISTA (COLONNA SINISTRA) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <UserPlus className="text-blue-600" size={18} />
              <span>Registra Nuovo Autista</span>
            </div>

            <form onSubmit={aggiungiAutista} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome</label>
                <input
                  type="text"
                  placeholder="Es. Mario"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cognome</label>
                <input
                  type="text"
                  placeholder="Es. Rossi"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Recapito Telefonico</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    type="tel"
                    placeholder="Es. 340 1234567"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">PIN di Accesso (6 cifre)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || pin.length < 4}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-xs tracking-wide transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Salvataggio...
                  </>
                ) : (
                  <>
                    <UserPlus size={15} /> Salva Operatore
                  </>
                )}
              </button>
            </form>
          </div>

          {/* LISTA AUTISTI (COLONNA DESTRA) */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="flex justify-center items-center py-20 text-slate-400">
                <Loader2 className="animate-spin text-blue-600" size={32} />
              </div>
            ) : autisti.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl text-center text-slate-500 border border-slate-200">
                Nessun operatore attivo censito a sistema.
              </div>
            ) : (
              autisti.map((a) => (
                <div
                  key={a.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-3 hover:border-slate-300 transition"
                >
                  <div className="flex items-center space-x-3.5">
                    {/* Badge Iniziali */}
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider uppercase shrink-0">
                      {(a.nome?.[0] || "") + (a.cognome?.[0] || "")}
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 text-base leading-tight">
                        {a.nome} {a.cognome}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        {a.telefono && (
                          <a
                            href={`tel:${a.telefono}`}
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                          >
                            <Phone size={12} className="text-slate-400" />
                            <span>{a.telefono}</span>
                          </a>
                        )}

                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                          <Key size={11} className="text-slate-400" />
                          PIN: {a.pin}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pulsante Disattiva */}
                  <button
                    onClick={() => eliminaAutista(a.id, `${a.nome} ${a.cognome}`)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Disattiva autista"
                  >
                    <UserX size={18} />
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