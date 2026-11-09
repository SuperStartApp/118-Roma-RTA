# Tessera pubblica e avviso autista - implementazione locale

Nessuna migrazione applicata, nessuna chiamata al database reale, nessun deploy.
La pagina pubblica diventa utilizzabile solo dopo preparazione e collaudo del database.

## Tessera

- Eccezione esatta nel layout: /tessera-pubblica. Le altre pagine restano in AccessoCentrale.
- I vecchi /tessera/<id> restano interni. Non vengono convertiti in link pubblici.
- Da Pazienti, Invia tessera WhatsApp crea un nuovo token e mostra Apri WhatsApp e invia tessera. Non invia messaggi automaticamente.
- Ogni emissione del link invalida il precedente, anche se il messaggio non viene poi inviato. Revoca link blocca le consultazioni successive.
- Token crittografico di 32 byte, hash SHA-256 nel DB. Token restituito solo alla creazione, conservato nel messaggio, non recuperabile dal DB.
- Il token viaggia nel frammento URL, viene rimosso dalla barra e passato in POST al backend. Ricaricando occorre riaprire il messaggio originale.
- Validita: fino a tutto il 31 dicembre dell'anno associativo; termine esclusivo al primo gennaio successivo, ore 00:00 Europe/Rome. Nessun limite di 30 giorni.
- La modifica del numero/anno revoca il link con un trigger dedicato, anche se poi si ripristinano i valori precedenti.
- Output: nome, cognome, numero, anno, emissione e scadenza associativa. Niente codice fiscale, data di nascita, ID, dati sanitari o trasporti.
- Token non valido/revocato/scaduto: stessa risposta 404 senza dati. Problema tecnico/configurazione: 503.
- Risposte API no-store, pagina senza indicizzazione e referrer. Nessun token nei log applicativi. Evitare log dei body POST e strumenti analitici che catturino frammenti, DOM o messaggi.
- Chi riceve il link puo leggere la tessera. Revoca e scadenza non cancellano dati o PDF gia scaricati.

## SQL da revisionare e autorizzare separatamente

File: supabase/migrations/20261109000100_tessera_pubblica.sql.

1. Ricognizione sul progetto corretto, tipi reali delle colonne e utilizzatori condivisi. Lo script richiede ID paziente UUID e colonne tessera esistenti.
2. Prima applicare/verificare AccessoCentrale con la sua procedura manuale. Non rieseguire la migrazione se gia applicata; non lanciare indiscriminatamente tutte le migrazioni.
3. Provare il nuovo SQL in un PostgreSQL isolato con dati sintetici: RLS, privilegi, revoca, scadenza, rotazione concorrente, rinnovo e trigger.
4. La migrazione nuova crea una tabella privata, tre RPC e un trigger su pazienti. Non cambia policy operative, Auth globale, RPC numerazione o tabelle degli altri progetti.
5. Nuove RPC gestionali: solo authenticated e controllo interno operatore corrente. RPC lettura: solo service_role, accesso anon/authenticated negato. Nuova tabella: nessun accesso diretto client.
6. SECURITY DEFINER: proprietario amministrativo fidato, search_path vuoto e nomi qualificati. Non esporre roma_rta_private nella Data API.
7. Configurare SUPABASE_SERVICE_ROLE_KEY esclusivamente nel backend e per lo stesso progetto. Non inserirla in NEXT_PUBLIC_* o nel repository. Il client server dedicato non eredita sessioni browser.
8. Prima della pubblicazione verificare grant ereditati/default, assenza di RPC/viste alternative e che anon non possa leggere/scrivere pazienti, prenotazioni, autisti. La migrazione controlla alcune precondizioni, non certifica tutto il progetto.
9. Per l'endpoint pubblico predisporre limiti di richieste nel proxy/hosting se esposto su Internet. Non e stato aggiunto un limitatore in memoria che fingerebbe copertura distribuita.

La migrazione AccessoCentrale originale resta invariata. I suoi controlli conservativi possono segnalare le nuove funzioni/trigger: non rimuovere quei controlli per rieseguirla dopo questa fase.
Numerazione tessera e relativo limite MAX+1 in concorrenza restano invariati.

## Avvisa autista e PIN

Pulsante nell'archivio corse (mobile e desktop) e vicino al WhatsApp cliente nel dettaglio.
Compare solo con autista assegnato e telefono sintatticamente valido (non e possibile certificare la registrazione WhatsApp senza API).
Apre https://web.whatsapp.com/send con numero e testo generico. Nessun paziente, tratta, identificativo corsa o PIN. Nessun invio automatico.
Il link usa il dominio ufficiale configurato in associazione.urlGestionale e il percorso /autista.
Assegnazione corse invariata; le query caricano in aggiunta il telefono autista.

Il PIN resta sospeso in app/autista/page.tsx e AccessoCentrale; il messaggio lo esplicita.
Per renderlo utilizzabile serve una fase distinta: verifica PIN sul server con hash sicuro, identificazione autista non ambigua, limitazione tentativi e blocco abusi, sessione sicura revocabile/scadente e autorizzazione server per le sole corse assegnate. Nessuna lettura anonima della tabella autisti, nessun PIN in localStorage come prova di identita. Servono API/RLS coerenti con la sessione scelta e migrazione dedicata dei PIN esistenti, senza alterarli automaticamente in questa fase.

Revisione SQL e piano di collaudo: [collaudo-tessera-pubblica.md](collaudo-tessera-pubblica.md).

## Verifica locale

TypeScript, node --test tests/*.test.mjs e build Next.js. Test API con mock: nessuna chiamata Supabase reale. I test non dimostrano l'esecuzione delle funzioni PostgreSQL: collaudo SQL/RLS isolato e prova end-to-end restano necessari prima dell'attivazione.
