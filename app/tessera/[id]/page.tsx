"use client";

import React, { useEffect, useState, Suspense } from "react";
import { supabase } from "@/app/lib/supabase";
import { useParams } from "next/navigation";
import { Printer, Loader2, ShieldCheck } from "lucide-react";

function TesseraContent() {
  const params = useParams();
  const [paziente, setPaziente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [annoCorrente, setAnnoCorrente] = useState<number>(2026);

  const LOGO_RTA = "https://www.romarta.it/wp-content/uploads/2026/10/WhatsApp-Image-2026-10-26-at-13.59.09.jpeg";
  const LOGO_REGIONE = "https://www.romarta.it/wp-content/uploads/2026/10/logo-REGIONE-LAZIO.png";

  useEffect(() => {
    setAnnoCorrente(new Date().getFullYear());

    async function fetchPaziente() {
      if (!params?.id) return;
      try {
        const { data, error } = await supabase
          .from("pazienti")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setPaziente(data);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPaziente();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="animate-spin text-blue-500" size={36} />
        <p className="text-sm font-semibold">Generazione tessera ufficiale...</p>
      </div>
    );
  }

  if (!paziente) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow text-center border border-slate-200">
          <p className="font-bold text-slate-800">Tessera non trovata o non ancora attiva.</p>
        </div>
      </div>
    );
  }

  const baseYear = paziente.anno_tessera || annoCorrente;
  const annoFormato = `${baseYear} / ${baseYear + 1}`;
  const cf = (paziente.codice_fiscale || "").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-200 py-10 px-4 flex flex-col items-center justify-center space-y-6 print:bg-white print:p-0">
      
      {/* LA TESSERA FEDELE ALL'ORIGINALE (Formato Badge Bianco) */}
      <div className="w-full max-w-[420px] bg-white text-slate-900 rounded-2xl p-6 sm:p-7 shadow-2xl border-2 border-slate-300 relative overflow-hidden print:shadow-none print:border print:m-0">
        
        {/* INTESTAZIONE: ROMA R.T.A. + ENTE ACCREDITATO REGIONE LAZIO */}
        <div className="flex justify-between items-start gap-3 pb-3 border-b-2 border-slate-900">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight font-serif uppercase">
              ROMA R.T.A.
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-800">
                ENTE ACCREDITATO
              </span>
              <img 
                src={LOGO_REGIONE} 
                alt="Regione Lazio" 
                className="h-5 sm:h-6 w-auto object-contain"
              />
            </div>
          </div>

          {/* Stemma Tondo Protezione Civile */}
          <div className="shrink-0">
            <img 
              src={LOGO_RTA} 
              alt="Logo Roma RTA" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow"
            />
          </div>
        </div>

        {/* ANNO E NUMERO TESSERA */}
        <div className="pt-3 pb-2 flex justify-between items-center text-xs">
          <div>
            <span className="text-sm font-black text-slate-900 block font-serif">
              {annoFormato}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-semibold text-slate-600">Tessera N°</span>
              <span className="font-mono font-black text-blue-900 text-sm">
                #{paziente.numero_tessera || "---"}
              </span>
            </div>
          </div>
        </div>

        {/* CAMPI DATI PAZIENTE (Fedeli alla tessera cartacea) */}
        <div className="space-y-3.5 pt-2 text-xs">
          
          {/* Nome */}
          <div className="border-b border-slate-400 pb-0.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Nome</span>
            <span className="font-bold text-slate-900 text-sm uppercase">
              {paziente.nome}
            </span>
          </div>

          {/* Cognome */}
          <div className="border-b border-slate-400 pb-0.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Cognome</span>
            <span className="font-bold text-slate-900 text-sm uppercase">
              {paziente.cognome}
            </span>
          </div>

          {/* Data di nascita */}
          <div className="border-b border-slate-400 pb-0.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Data di nascita</span>
            <span className="font-semibold text-slate-800">
              {paziente.data_nascita 
                ? new Date(paziente.data_nascita).toLocaleDateString("it-IT") 
                : "—"}
            </span>
          </div>

          {/* Codice Fiscale a Caselle */}
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Cod. fiscale</span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 16 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-5 h-6 border border-slate-400 rounded-sm flex items-center justify-center font-mono font-bold text-[11px] text-blue-950 bg-slate-50"
                >
                  {cf[i] || ""}
                </div>
              ))}
            </div>
          </div>

          {/* SOCIO SOSTENITORE */}
          <div className="pt-3 pb-1 text-center border-t-2 border-slate-900 mt-4">
            <h2 className="text-lg sm:text-xl font-black text-blue-950 tracking-wider uppercase font-serif">
              SOCIO SOSTENITORE
            </h2>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
              <span>Qualifica: Sostenitore</span>
              <span className="text-emerald-700 flex items-center gap-1">
                <ShieldCheck size={12} /> Valida
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* AZIONE STAMPA / SALVA PDF */}
      <div className="flex gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95"
        >
          <Printer size={16} /> Stampa / Salva PDF Ufficiale
        </button>
      </div>

    </div>
  );
}

export default function TesseraSocioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="animate-spin text-blue-500" size={36} />
        <p className="text-sm">Caricamento tessera...</p>
      </div>
    }>
      <TesseraContent />
    </Suspense>
  );
}