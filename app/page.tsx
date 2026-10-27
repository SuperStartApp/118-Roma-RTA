"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  PlusCircle, 
  Users, 
  FileSpreadsheet, 
  ArrowUpRight, 
  Ambulance, 
  ShieldCheck,
  ClipboardList,
  Lock,
  KeyRound,
  LogOut,
  AlertCircle,
  Sparkles
} from "lucide-react";

const MASTER_PIN = "1972";

export default function HomePage() {
  const [autenticato, setAutenticato] = useState<boolean | null>(null);
  const [pinInserito, setPinInserito] = useState("");
  const [errorePin, setErrorePin] = useState(false);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("centrale_sbloccata") === "true";
    setAutenticato(isAuth);
  }, []);

  const handleVerificaPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInserito === MASTER_PIN) {
      sessionStorage.setItem("centrale_sbloccata", "true");
      setAutenticato(true);
      setErrorePin(false);
      setPinInserito("");
    } else {
      setErrorePin(true);
      setPinInserito("");
    }
  };

  const handleBloccaSchermo = () => {
    sessionStorage.removeItem("centrale_sbloccata");
    setAutenticato(false);
  };

  if (autenticato === null) {
    return <div className="min-h-screen bg-slate-900" />;
  }

  // SCHERMATA DI BLOCCO PIN (1972)
  if (!autenticato) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-2xl border border-slate-800 text-center space-y-6">
          
          <div className="w-16 h-16 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Lock size={28} strokeWidth={2.2} />
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Centrale Operativa
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Inserisci il PIN master di sicurezza per accedere
            </p>
          </div>

          {errorePin && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 text-left">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>PIN non valido. Riprova.</span>
            </div>
          )}

          <form onSubmit={handleVerificaPin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              value={pinInserito}
              onChange={(e) => {
                setErrorePin(false);
                setPinInserito(e.target.value.replace(/\D/g, "").slice(0, 4));
              }}
              autoFocus
              className="w-full text-center text-3xl font-mono tracking-[0.5em] py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition"
            />

            <button
              type="submit"
              disabled={pinInserito.length < 4}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              Sblocca Centrale
            </button>
          </form>

          {/* Tastierino touch rapido */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => {
                  if (btn === "C") setPinInserito("");
                  else if (btn === "OK") {
                    if (pinInserito === MASTER_PIN) {
                      sessionStorage.setItem("centrale_sbloccata", "true");
                      setAutenticato(true);
                    } else {
                      setErrorePin(true);
                      setPinInserito("");
                    }
                  } else {
                    if (pinInserito.length < 4) setPinInserito((prev) => prev + btn);
                  }
                }}
                className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-sm transition"
              >
                {btn}
              </button>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // SCHEDE DASHBOARD
  const cards = [
    {
      href: "/prenotazioni",
      title: "Quadro Operativo Corse",
      description: "Turno odierno, chiamate da assegnare e archivio storico con riassegnazione rapida.",
      icon: ClipboardList,
      badge: "Centrale Servizi",
      highlighted: true, // QUESTA CARD È IL CUORE PULSANTE
    },
    {
      href: "/prenotazione",
      title: "Nuova Prenotazione",
      description: "Inserisci i dati della chiamata, calcola tariffe e orari di trasporto.",
      icon: PlusCircle,
      badge: "Accettazione",
      iconColor: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      href: "/pazienti",
      title: "Rubrica Pazienti & Soci",
      description: "Anagrafica assistiti, condizioni cliniche, storico e rilascio tessere socio.",
      icon: Users,
      badge: "Anagrafica & Tessere",
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
    {
      href: "/autisti",
      title: "Gestione Personale",
      description: "Anagrafica autisti e soccorritori, recapiti telefonici e PIN operativi di bordo.",
      icon: ShieldCheck,
      badge: "Staff & Risorse",
      iconColor: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      href: "/report",
      title: "Reportistica & Export",
      description: "Esporta i dati contabili in Excel o genera le ricevute di trasporto in formato PDF.",
      icon: FileSpreadsheet,
      badge: "Amministrazione",
      iconColor: "text-slate-700 bg-slate-100 border-slate-200",
    },
    {
      href: "/autista",
      title: "Area Terminale Autista",
      description: "Accesso rapido con codice PIN per il personale in servizio sull'ambulanza.",
      icon: Ambulance,
      badge: "Personale Viaggiante",
      iconColor: "text-rose-600 bg-rose-50 border-rose-100",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* BANNER DI BENVENUTO / STATUS CENTRALE */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Centrale Operativa Attiva
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Pannello di Controllo <span className="text-blue-400">AmbulancePro</span>
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Gestione unificata dei trasporti sanitari, assegnazione equipaggi e anagrafica tessere soci sostenitori.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <Link
              href="/prenotazione"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              <PlusCircle size={16} />
              <span>Nuovo Servizio</span>
            </Link>

            <button
              onClick={handleBloccaSchermo}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Blocca postazione centrale"
            >
              <Lock size={15} />
              <span>Blocca</span>
            </button>
          </div>
        </div>

        {/* GRIGLIA FUNZIONALITÀ CON CARD IN EVIDENZA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            const isHigh = card.highlighted;

            return (
              <Link
                key={card.href}
                href={card.href}
                className={`group p-6 rounded-3xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden ${
                  isHigh
                    ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xl shadow-blue-500/25 ring-2 ring-blue-400/50 hover:shadow-2xl hover:scale-[1.02] border border-blue-400/40"
                    : "bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md hover:scale-[1.01]"
                }`}
              >
                {/* Glow decorativo per la card in evidenza */}
                {isHigh && (
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                )}

                <div>
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                      isHigh
                        ? "bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-inner"
                        : `${card.iconColor} border`
                    }`}>
                      <Icon size={24} strokeWidth={2.3} />
                    </div>

                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 ${
                      isHigh
                        ? "bg-white/25 text-white backdrop-blur-sm border border-white/30"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      {isHigh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      {card.badge}
                    </span>
                  </div>

                  <h2 className={`text-xl font-extrabold transition flex items-center justify-between relative z-10 ${
                    isHigh ? "text-white" : "text-slate-900 group-hover:text-blue-600"
                  }`}>
                    <span>{card.title}</span>
                    <ArrowUpRight size={18} className={`transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                      isHigh ? "text-white/80" : "text-slate-400 opacity-0 group-hover:opacity-100"
                    }`} />
                  </h2>

                  <p className={`text-xs mt-2 leading-relaxed relative z-10 ${
                    isHigh ? "text-blue-100" : "text-slate-500"
                  }`}>
                    {card.description}
                  </p>
                </div>

                <div className={`pt-5 mt-4 border-t flex items-center justify-between text-xs font-bold transition relative z-10 ${
                  isHigh 
                    ? "border-white/20 text-white" 
                    : "border-slate-100 text-slate-700 group-hover:text-blue-600"
                }`}>
                  <span>{isHigh ? "Entra nel Quadro Corse →" : "Accedi alla sezione"}</span>
                  {isHigh && <Sparkles size={14} className="text-amber-300" />}
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}