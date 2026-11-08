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
  AlertCircle,
  CalendarDays
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

  const sections = [
    {
      id: "operativita",
      title: "Sezioni operative",
      description: "Organizza i trasporti e ritrova subito le schede dei pazienti.",
      operativa: true,
      cards: [
        {
          href: "/prenotazioni",
          title: "Gestione corse",
          description: "Corse di oggi, servizi da assegnare e archivio. Gestisci autisti e stato dei pagamenti.",
          icon: ClipboardList,
          action: "Apri gestione corse",
        },
        {
          href: "/pazienti",
          title: "Pazienti e tessere",
          description: "Cerca un paziente, consulta lo storico e accedi alla sua tessera associativa.",
          icon: Users,
          action: "Apri pazienti e tessere",
        },
      ],
    },
    {
      id: "gestione",
      title: "Sezioni gestionali",
      description: "Anagrafiche del personale, documenti e rendicontazione.",
      operativa: false,
      cards: [
        {
          href: "/autisti",
          title: "Autisti",
          description: "Gestisci anagrafica, recapiti e PIN degli autisti.",
          icon: Ambulance,
          action: "Gestisci autisti",
        },
        {
          href: "/report",
          title: "Amministrazione e report",
          description: "Consulta i rendiconti, esporta Excel e scarica report e ricevute PDF.",
          icon: FileSpreadsheet,
          action: "Apri amministrazione e report",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <section aria-labelledby="centrale-titolo" className="rounded-3xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-200">
                <ShieldCheck size={14} aria-hidden="true" /> Postazione sbloccata
              </div>
              <h1 id="centrale-titolo" className="text-2xl font-extrabold tracking-tight md:text-3xl">
                Centrale operativa <span className="text-blue-300">ROMA R.T.A.</span>
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Crea un trasporto, assegna un autista e gestisci le corse dalla centrale.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
              <Link href="/prenotazione" className="rta-primary-action inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold shadow-sm">
                <PlusCircle size={22} aria-hidden="true" /> Nuovo trasporto
              </Link>
              <button type="button" onClick={handleBloccaSchermo} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">
                <Lock size={15} aria-hidden="true" /> Blocca postazione
              </button>
            </div>
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id + "-titolo"} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id={section.id + "-titolo"} className={section.operativa ? "text-xl font-bold text-slate-900" : "text-lg font-bold text-slate-700"}>{section.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{section.description}</p>
              </div>
              {section.operativa && (
                <Link href="/agenda" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  <CalendarDays size={17} aria-hidden="true" /> Consulta agenda
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.href} href={card.href} className={section.operativa
                    ? "rta-dashboard-card group rounded-2xl border border-blue-200 border-l-4 border-l-blue-600 bg-white p-5 shadow-sm md:p-6"
                    : "rta-dashboard-card group rounded-2xl border border-slate-200 bg-slate-100 p-4 md:p-5"}>
                    <div className="flex items-start gap-4">
                      <div className={section.operativa
                        ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"}>
                        <Icon size={section.operativa ? 24 : 20} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={section.operativa ? "text-xl font-bold text-slate-900" : "text-base font-bold text-slate-800"}>{card.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
                      </div>
                      <ArrowUpRight size={18} aria-hidden="true" className="shrink-0 text-slate-500 group-hover:text-blue-700" />
                    </div>
                    <div className={section.operativa ? "mt-5 border-t border-blue-100 pt-3 text-sm font-semibold text-blue-700" : "mt-3 pl-14 text-sm font-semibold text-slate-700"}>
                      {card.action}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <aside aria-labelledby="area-autista-titolo" className="flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <KeyRound size={22} aria-hidden="true" className="mt-1 shrink-0 text-slate-600" />
            <div>
              <h2 id="area-autista-titolo" className="text-base font-bold text-slate-800">Area autista con PIN</h2>
              <p className="mt-1 text-sm text-slate-600">Accesso separato per consultare le corse assegnate e usare le funzioni di bordo.</p>
            </div>
          </div>
          <Link href="/autista" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Accedi con PIN <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
