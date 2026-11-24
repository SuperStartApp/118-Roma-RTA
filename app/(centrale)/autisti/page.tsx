"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import { 
  UserPlus, 
  UserX, 
  Phone, 
  Key, 
  Users, 
  Copy, 
  Check, 
  MessageSquare, 
  ExternalLink,
  Loader2,
  Ambulance
} from "lucide-react";

export default function GestioneAutisti() {
  const [autisti, setAutisti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pin, setPin] = useState("");
  const [pinConferma, setPinConferma] = useState<{
    nome: string;
    pin: string;
  } | null>(null);
  const [pinCopiato, setPinCopiato] = useState(false);

  function generaPin() {
    const valori = new Uint32Array(1);
    do {
      crypto.getRandomValues(valori);
    } while (valori[0] >= 4294000000);
    setPin(String(valori[0] % 1000000).padStart(6, "0"));
  }

  // Stati per feedback di copia
  const [copiedLink, setCopiedLink] = useState(false);
  const [nuovoPin, setNuovoPin] = useState<{id: string; pin: string} | null>(null);
  const [rigenerazione, setRigenerazione] = useState<string | null>(null);

  async function rigeneraPin(id: string, nominativo: string) {
    if (!confirm(`Generare un nuovo PIN per ${nominativo}? Il precedente PIN non sara piu valido.`)) return;

    setNuovoPin(null);
    setRigenerazione(id);

    try {
      const { data, error } = await supabase.rpc(
        "roma_rta_autista_rigenera_pin",
        { p_autista_id: id }
      );

      if (error) throw error;
      if (typeof data !== "string" || !/^[0-9]{6}$/.test(data)) {
        throw new Error("Risposta non valida");
      }

      setPinCopiato(false);
      setPinConferma({
        nome: nominativo,
        pin: data
      });
    } catch {
      alert("Impossibile generare il PIN. Riprova.");
    } finally {
      setRigenerazione(null);
    }
  }

  async function copiaNuovoPin(pin: string) {
    try {
      await navigator.clipboard.writeText(pin);
      alert("PIN copiato");
    } catch {
      alert("Copia non riuscita. Copia manualmente il PIN.");
    }
  }

  useEffect(() => {
    fetchAutisti();
  }, []);

  async function fetchAutisti() {
    setLoading(true);
    setErroreCaricamento(null);
    try {
      const { data, error } = await supabase
        .from("autisti")
        .select("id,nome,cognome,telefono,attivo,numero_tessera,anno_tessera")
        .eq("attivo", true)
        .order("cognome", { ascending: true });

      if (error) throw error;
      setAutisti(data || []);
    } catch (err: any) {
      console.error(err);
      setErroreCaricamento("Impossibile caricare gli autisti. Verifica la connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function aggiungiAutista(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("roma_rta_autista_registra", {
        p_nome: nome.trim(),
        p_cognome: cognome.trim(),
        p_telefono: telefono.trim(),
        p_pin: pin.trim()
      });
      if (error) throw error;

      setPinCopiato(false);
      setPinConferma({
        nome: `${nome} ${cognome}`,
        pin: pin.trim()
      });

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

  // Ottiene l'URL completo del login autisti (es. https://tuo-sito.vercel.app/autista)
  const getAutistaLoginUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/autista`;
    }
    return "/autista";
  };

  // Copia negli appunti il link generico
  const copiaLinkTerminale = async () => {
    setCopiedLink(false);
    try {
      await navigator.clipboard.writeText(getAutistaLoginUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      alert("Impossibile copiare il link. Verifica i permessi del browser oppure usa Apri pannello autista.");
    }
  };

  // Genera e invia il messaggio WhatsApp completo di Credenziali all'autista
  const inviaCredenzialiWhatsApp = (autista: any) => {
    if (!autista.telefono) return;

    let num = autista.telefono.replace(/\D/g, "");
    if (num.length === 10 && !num.startsWith("39")) {
      num = "39" + num;
    }

    const loginUrl = getAutistaLoginUrl();

    const messaggio = 
`*ROMA R.T.A. - ACCESSO TERMINALE DI BORDO*

Ciao *${autista.nome}*,
ecco le tue credenziali di accesso per visualizzare le corse assegnate e i fogli di viaggio:

*Link di Accesso:*
${loginUrl}

*Utilizza il PIN personale comunicato dalla centrale.*

*Istruzioni:*
1. Clicca sul link dal tuo smartphone
2. Inserisci il tuo PIN personale
3. Visualizzerai gli orari, i pazienti e il pulsante con il navigatore per ogni missione.

_Centrale Operativa Roma R.T.A._`;

    window.open(`https://wa.me/${num}?text=${encodeURIComponent(messaggio)}`, "_blank");
  };

  if (erroreCaricamento && !loading) return <ErroreCaricamento messaggio={erroreCaricamento} onRiprova={() => void fetchAutisti()} />;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      {pinConferma && (
  <div className="fixed inset-0 z-[100] bg-slate-950/70 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titolo-conferma-pin"
      className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-5 text-center"
    >
      <Check size={42} className="mx-auto text-green-600" />

      <h2 id="titolo-conferma-pin" className="text-xl font-bold text-slate-900">
        PIN generato correttamente
      </h2>

      <p className="font-semibold text-slate-700">
        {pinConferma.nome}
      </p>

      <div className="bg-slate-100 rounded-xl p-5">
        <p className="text-sm text-slate-600 mb-2">
          PIN personale di accesso
        </p>
        <div className="font-mono text-4xl font-bold tracking-widest text-slate-900">
          {pinConferma.pin}
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(pinConferma.pin);
            setPinCopiato(true);
          } catch {
            alert("Copia non riuscita. Annota manualmente il PIN.");
          }
        }}
        className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
      >
        {pinCopiato ? <Check size={20} /> : <Copy size={20} />}
        {pinCopiato ? "PIN COPIATO" : "COPIA PIN"}
      </button>

      <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">
        Comunica o annota il PIN prima di chiudere.
        Per sicurezza non potrai visualizzarlo nuovamente.
      </p>

      <button
        type="button"
        onClick={() => {
          if (!confirm("Hai annotato o comunicato il PIN? Dopo la chiusura non sara recuperabile.")) return;
          setPinConferma(null);
          setPinCopiato(false);
        }}
        className="w-full border border-slate-300 rounded-xl py-3 font-semibold text-slate-700 hover:bg-slate-50"
      >
        Ho annotato il PIN, chiudi
      </button>
    </div>
  </div>
)}

<div className="max-w-6xl mx-auto space-y-6">
        
        {/* INTESTAZIONE PAGINA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <Users size={14} /> Risorse Umane & Equipaggi
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Autisti
            </h1>
          </div>
          <div>
            <span className="px-3 py-1 rounded-md text-xs font-semibold bg-slate-200 text-slate-800">
              {autisti.length} {autisti.length === 1 ? "autista attivo" : "autisti attivi"}
            </span>
          </div>
        </div>

        {/* BOX INFORMATIVO CON LINK TERMINALE CONDIVISIBILE */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-slate-800">
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <Ambulance size={20} />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-bold text-white">Pannello riservato agli autisti</h2>
              <p className="text-sm text-slate-300">Un unico collegamento, accesso con il PIN personale.</p>
              <p className="text-xs text-blue-200 font-mono break-all">
                {typeof window !== "undefined" ? getAutistaLoginUrl() : "/autista"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={copiaLinkTerminale}
              className="inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span aria-live="polite">{copiedLink ? "Link copiato" : "Copia link"}</span>
            </button>
            <a
              href="/autista"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-white hover:bg-blue-50 text-blue-950 transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            >
              <ExternalLink size={14} />
              <span>Apri pannello autista</span>
            </a>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Recapito Telefonico (per WhatsApp)</label>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">PIN di accesso (6 cifre)</label>
                <button
                  type="button"
                  onClick={generaPin}
                  className="mb-2 text-xs font-bold text-blue-600 hover:underline"
                >
                  Genera PIN automatico
                </button>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Es. 123456" value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || pin.length !== 6}
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
                  className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start sm:items-center space-x-3.5">
                    {/* Badge Iniziali */}
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base tracking-wider uppercase shrink-0">
                      {(a.nome?.[0] || "") + (a.cognome?.[0] || "")}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-base leading-tight">
                        {a.nome} {a.cognome}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                        {a.telefono && (
                          <a
                            href={`tel:${a.telefono}`}
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-600 transition"
                          >
                            <Phone size={12} className="text-slate-400" />
                            <span>{a.telefono}</span>
                          </a>
                        )}

                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Key size={11} className="text-slate-400" />
                          Accesso con PIN personale
                        </span>
                      </div>
                    </div>
                  </div>
                    <button
                      type="button"
                      onClick={() => eliminaAutista(a.id, `${a.nome} ${a.cognome}`)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                      title="Disattiva operatore"
                    >
                      <UserX size={15} /> Disattiva
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3 space-y-3">
  <p className="text-xs font-bold text-slate-700">
    Gestione PIN personale
  </p>

  <button
    type="button"
    disabled={rigenerazione !== null}
    onClick={() => rigeneraPin(a.id, `${a.nome} ${a.cognome}`)}
    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50"
  >
    <Key size={15} />
    {rigenerazione === a.id ? "Generazione..." : "Genera nuovo PIN"}
  </button>

  {nuovoPin !== null && nuovoPin.id === a.id && (
    <div className="rounded-lg bg-slate-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-2xl font-bold tracking-widest">
          {nuovoPin.pin}
        </span>
        <button
          type="button"
          onClick={() => copiaNuovoPin(nuovoPin.pin)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
        >
          <Copy size={14} /> Copia PIN
        </button>
        <button
          type="button"
          onClick={() => setNuovoPin(null)}
          className="text-sm text-slate-600"
        >
          Nascondi
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Comunica il nuovo PIN separatamente dal link.
      </p>
    </div>
  )}
</div>

<div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-3">
                    <p className="text-xs font-bold text-blue-950">Condividi l'accesso al pannello autista</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {a.telefono && (
                      <button
                        type="button"
                        onClick={() => inviaCredenzialiWhatsApp(a)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-bold transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        title="Invia link su WhatsApp all'autista"
                      >
                        <MessageSquare size={13} />
                        <span>Invia WhatsApp</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={copiaLinkTerminale}
                      className="inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm font-semibold text-blue-800 hover:bg-blue-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {copiedLink ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                      <span aria-live="polite">{copiedLink ? "Link copiato" : "Copia link"}</span>
                    </button>

                    </div>
                    <p className="text-xs text-slate-600">
                      {a.telefono ? "Il messaggio WhatsApp contiene soltanto il link. Il PIN va comunicato separatamente." : "Telefono non disponibile: copia il link e comunica separatamente il PIN."}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
