"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { creaAccessoCentrale, type StatoAccesso } from "@/app/lib/accesso-centrale";
import AutistaLogin from "@/app/autista/page";

type Accesso = StatoAccesso & {
  accedi: (email: string, password: string) => Promise<void>;
  esci: () => Promise<void>;
  riprova: () => void;
};
const ContestoAccesso = createContext<Accesso | null>(null);

function useAccesso() {
  const accesso = useContext(ContestoAccesso);
  if (!accesso) throw new Error("Contesto accesso centrale mancante");
  return accesso;
}

export function LoginCentrale() {
  const { stato, messaggio, accedi, esci, riprova } = useAccesso();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <ShieldCheck className="mb-4 text-blue-700" size={32} aria-hidden="true" />
        <h1 className="text-2xl font-bold text-blue-950">ROMA R.T.A.</h1>
        <p className="mt-1 text-sm text-slate-600">Accesso riservato alla centrale operativa</p>
        {messaggio && <p role="status" className="mt-5 rounded-xl bg-slate-100 p-3 text-sm text-slate-800">{messaggio}</p>}
        {stato === "autorizzato" ? (
          <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 font-bold text-white">Apri centrale operativa</Link>
        ) : stato === "negato" || stato === "errore" ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={riprova} className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">Riprova verifica</button>
            <button onClick={() => void esci()} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">Esci / cambia account</button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            const segreto = password;
            setPassword("");
            await accedi(email, segreto);
          }}>
            <label className="block text-sm font-semibold text-slate-700">Email
              <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={stato === "verifica"} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Password
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={stato === "verifica"} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <button disabled={stato === "verifica"} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-60">
              {stato === "verifica" && <Loader2 size={18} className="animate-spin" />}Accedi alla centrale
            </button>
          </form>
        )}
        <p className="mt-5 text-xs leading-relaxed text-slate-500">Gli account sono abilitati dall’amministratore. Per assistenza o recupero dell’accesso contatta la centrale.</p>
      </section>
    </div>
  );
}

export function PulsanteLogout() {
  const { esci } = useAccesso();
  return <button type="button" onClick={() => void esci()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-200 hover:bg-slate-800" title="Esci dalla centrale"><LogOut size={16} aria-hidden="true" />Esci</button>;
}

export default function AccessoCentrale({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [accesso, setAccesso] = useState<StatoAccesso>({ stato: "verifica", messaggio: "Verifica accesso alla centrale…" });
  const controllo = useRef<ReturnType<typeof creaAccessoCentrale> | null>(null);

  useEffect(() => {
    const corrente = creaAccessoCentrale(supabase, setAccesso);
    controllo.current = corrente;
    let timer: ReturnType<typeof setTimeout>;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(timer);
      if (event === "SIGNED_OUT") corrente.sessioneTerminata();
      else {
        corrente.sessioneAggiornata(session?.user.id);
        timer = setTimeout(() => void corrente.verifica(), 0);
      }
    });
    const verificaVisibile = () => { if (document.visibilityState === "visible") void corrente.verifica(); };
    const intervallo = setInterval(verificaVisibile, 60_000);
    window.addEventListener("focus", verificaVisibile);
    document.addEventListener("visibilitychange", verificaVisibile);
    void corrente.verifica();
    return () => {
      corrente.chiudi();
      controllo.current = null;
      clearTimeout(timer);
      clearInterval(intervallo);
      subscription.unsubscribe();
      window.removeEventListener("focus", verificaVisibile);
      document.removeEventListener("visibilitychange", verificaVisibile);
    };
  }, []);

  const autistaSospeso = pathname === "/autista" || pathname.startsWith("/autista/");
  return (
    <ContestoAccesso.Provider value={{ ...accesso,
      accedi: async (email, password) => { await controllo.current?.accedi(email, password); },
      esci: async () => { await controllo.current?.esci(); },
      riprova: () => { void controllo.current?.verifica(); },
    }}>
      {autistaSospeso ? (
        <AutistaLogin />
      ) : accesso.stato === "autorizzato" ? children : <LoginCentrale />}
    </ContestoAccesso.Provider>
  );
}
