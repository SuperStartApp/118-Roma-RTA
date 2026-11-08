import type { SupabaseClient } from "@supabase/supabase-js";

export type StatoAccesso = {
  stato: "verifica" | "anonimo" | "autorizzato" | "negato" | "errore";
  messaggio: string;
};

// Il risultato locale serve alla UI. Le autorizzazioni effettive sono nelle RLS.
export function creaAccessoCentrale(client: SupabaseClient, aggiorna: (stato: StatoAccesso) => void) {
  let versione = 0;
  let chiuso = false;
  let statoCorrente: StatoAccesso["stato"] = "verifica";
  let utenteVerificato: string | null = null;
  const pubblica = (stato: StatoAccesso, richiesta: number) => {
    if (!chiuso && richiesta === versione) {
      statoCorrente = stato.stato;
      aggiorna(stato);
    }
  };

  async function verifica() {
    const richiesta = ++versione;
    // I controlli periodici non smontano un modulo autorizzato in compilazione.
    if (statoCorrente !== "autorizzato") pubblica({ stato: "verifica", messaggio: "Verifica accesso alla centrale…" }, richiesta);
    try {
      // getUser verifica la sessione con Supabase Auth; nessuna fiducia in ID locali.
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) {
        const sessioneAssente = !data.user && (!error || error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403);
        pubblica(sessioneAssente
          ? { stato: "anonimo", messaggio: "Accedi alla centrale. Se la sessione è scaduta, inserisci nuovamente le credenziali." }
          : { stato: "errore", messaggio: "Impossibile verificare la sessione. Controlla la connessione e riprova." }, richiesta);
        return;
      }
      if (richiesta !== versione || chiuso) return;
      if (utenteVerificato !== data.user.id) {
        pubblica({ stato: "verifica", messaggio: "Verifica operatore…" }, richiesta);
      }
      const { data: consentito, error: ruoloError } = await client.rpc("roma_rta_operatore_abilitato");
      if (ruoloError) {
        pubblica({ stato: "errore", messaggio: "Verifica operatore non disponibile. Riprova o contatta l’amministratore per controllare la configurazione degli accessi." }, richiesta);
        return;
      }
      if (richiesta !== versione || chiuso) return;
      utenteVerificato = data.user.id;
      pubblica(consentito === true
        ? { stato: "autorizzato", messaggio: "" }
        : { stato: "negato", messaggio: "Accesso negato: questo account non è abilitato alla centrale ROMA R.T.A." }, richiesta);
    } catch {
      pubblica({ stato: "errore", messaggio: "Connessione non disponibile. Impossibile verificare l’accesso: riprova." }, richiesta);
    }
  }

  async function accedi(email: string, password: string) {
    const richiesta = ++versione;
    pubblica({ stato: "verifica", messaggio: "Accesso in corso…" }, richiesta);
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        pubblica({ stato: "anonimo", messaggio: "Accesso non riuscito. Verifica email e password, oppure riprova tra poco." }, richiesta);
        return;
      }
      if (!chiuso && richiesta === versione) await verifica();
    } catch {
      pubblica({ stato: "anonimo", messaggio: "Accesso non riuscito. Controlla la connessione e riprova." }, richiesta);
    }
  }

  async function esci() {
    const richiesta = ++versione;
    // Smonta subito le pagine e i relativi dati, anche se il logout fallisce.
    pubblica({ stato: "verifica", messaggio: "Uscita in corso…" }, richiesta);
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      pubblica(error
        ? { stato: "errore", messaggio: "Uscita non confermata. Riprova a uscire prima di lasciare il dispositivo." }
        : { stato: "anonimo", messaggio: "Hai effettuato l’uscita dalla centrale." }, richiesta);
    } catch {
      pubblica({ stato: "errore", messaggio: "Uscita non confermata. Controlla la connessione e riprova a uscire." }, richiesta);
    }
  }

  function sessioneTerminata() {
    utenteVerificato = null;
    pubblica({ stato: "anonimo", messaggio: "Sessione terminata. Accedi nuovamente alla centrale." }, ++versione);
  }

  function sessioneAggiornata(userId: string | undefined) {
    if (userId !== utenteVerificato) {
      pubblica({ stato: "verifica", messaggio: "Verifica sessione…" }, ++versione);
    }
  }

  return { verifica, accedi, esci, sessioneTerminata, sessioneAggiornata, chiudi: () => { chiuso = true; versione++; } };
}
