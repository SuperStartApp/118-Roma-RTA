# Revisione finale e piano SQL isolato - NON ESEGUITO

Nessuna migrazione eseguita, neppure locale. Nessuna connessione al database remoto.
Questo documento prepara un collaudo futuro; i test Node non certificano PostgreSQL/RLS.

## Correzioni e significato dei dati

anno_tessera e l'anno associativo nel codice: app/pazienti/page.tsx lo propone/modifica con il numero; app/tessera/[id]/page.tsx stampa Scadenza 31/12/anno; app/autista/dashboard/page.tsx riporta la stessa validita nel messaggio. Non e l'anno di nascita o di prenotazione. La semantica del codice e verificata; qualita e significato dei valori remoti non sono stati accertati.
La RPC genera il termine esclusivo make_timestamptz(anno+1,1,1,0,0,0,'Europe/Rome'). Esempio 2026: 2027-01-01 00:00+01, cioe 2026-12-31 23:00Z. Valido durante tutto il 31 dicembre locale, non da quell'istante in poi. Nessun taglio a 30 giorni.
La stampa pubblica restituisce numero/anno salvati nella condivisione e verifica che coincidano con pazienti. La stampa interna usa gli stessi valori del paziente. La data di emissione resta quella registrata, senza inventare date mancanti.
Numero mancante, zero, negativo o non intero positivo e anno fuori intervallo 1900..9998 impediscono la condivisione. I tipi reali vanno verificati prima del DDL: ID UUID, numero/anno numerici interi coerenti, data_tesseramento convertibile a date. Nessuna conversione automatica dei dati remoti.

## SECURITY DEFINER, RLS e auth.uid

Le funzioni nuove appartengono al ruolo che esegue la migrazione. Il preflight richiede un amministratore e verifica che possa superare RLS su pazienti/operatori come superuser/BYPASSRLS oppure proprietario senza FORCE RLS. Verifica anche proprietario, SECURITY DEFINER, risultato booleano e search_path dell'helper AccessoCentrale. Non concede privilegi per superare un controllo fallito.
Le funzioni gestionali verificano auth.uid() non nullo e l'helper operatore prima e dopo il lock del paziente. L'helper legge operatori_centrale ed e separato dalla tabella pazienti: non c'e ricorsione di policy. Le funzioni nuove superano intenzionalmente le RLS con i privilegi amministrativi, percio il controllo interno non puo essere sostituito dal solo gate React o da GRANT authenticated.
SECURITY DEFINER cambia il ruolo effettivo SQL, non i claim JWT impostati da PostgREST. auth.uid() continua a ricavare il sub dell'operatore dai claim della richiesta. L'API gestionale usa chiave pubblica + Authorization Bearer dell'utente verificato con getUser, mai service_role. Nessun parametro creato_da o user_id proviene dal browser: creato_da viene da auth.uid(). Verificare nel collaudo la definizione auth.uid effettiva dell'istanza e il valore scritto dopo commit.
Lo schema privato mantiene i GRANT della fase 1: authenticated ha USAGE ma non CREATE o diritti sulle tabelle; anon non ha USAGE/CREATE. Il preflight controlla anche che service_role non abbia CREATE privato e abbia USAGE su public. Il ruolo service_role non necessita USAGE privato per eseguire la funzione DEFINER pubblica: le letture interne usano il proprietario della funzione.

| Oggetto nuovo | anon | authenticated | service_role |
| --- | --- | --- | --- |
| Tabella condivisioni, ACL dirette | nessuna | nessuna | nessuna |
| RPC crea/revoca | EXECUTE negato | EXECUTE, verifica operatore interna | EXECUTE negato |
| RPC lettura limitata | EXECUTE negato | EXECUTE negato | EXECUTE consentito |
| Funzione trigger | EXECUTE diretto negato | EXECUTE diretto negato | EXECUTE diretto negato |

BYPASSRLS non sostituisce ACL e USAGE. La service_role resta comunque una credenziale amministrativa ampia per il progetto: le altre tabelle possono gia avere GRANT a quel ruolo. Nessun privilegio globale viene cambiato qui.
Il solo punto di lettura pubblica e app/api/tessera-pubblica/route.ts: una RPC roma_rta_leggi_tessera(hash), nessun from/select generico. La risposta HTTP filtra di nuovo i sei campi previsti. Il client privato server-only e separato dal client gestionale e non riceve cookie/JWT utente. Nessun riferimento alla chiave privata nei moduli client.

## Concorrenza, trigger e limiti

Creazione/rotazione e revoca bloccano prima pazienti, poi condivisioni; il trigger parte da una modifica gia bloccata del paziente e aggiorna dopo condivisioni. Stesso ordine dei lock. Una sola riga corrente per paziente e hash univoco; rollback atomico su errore. Due creazioni serializzano: solo l'ultima resta valida, anche se la prima risposta HTTP arriva dopo. Nessun retry automatico che invalidi di nascosto un link appena consegnato.
Le funzioni di scrittura/trigger hanno lock_timeout 5s. L'istante di creazione usa clock_timestamp DOPO il lock, evitando un now() arretrato dalla transazione. La lettura STABLE usa statement_timestamp, non now(): una transazione iniziata prima del Capodanno non prolunga da sola il link nelle istruzioni successive.
La visibilita segue gli snapshot PostgreSQL: una consultazione gia iniziata prima di revoca/rotazione puo completarsi con i vecchi dati. In READ COMMITTED le nuove richieste vedono il commit; una sessione SQL REPEATABLE READ puo conservare snapshot vecchi. Le API devono usare transazioni brevi standard, non sessioni riutilizzate con transazioni aperte.
Il trigger AFTER UPDATE con WHEN reagisce solo a variazioni effettive numero/anno, comprese variazioni prodotte da altri BEFORE trigger. Telefono, nome, patologia o salvataggio di valori tessera invariati non revocano. Non cambia NEW o colonne del paziente. Tornare al vecchio numero/anno non riabilita il link. Se la revoca fallisce (lock timeout, ACL, errore DB), fallisce e fa rollback anche la modifica tessera: comportamento intenzionale per evitare link incoerenti.
Eventuali altri trigger/event trigger o consumer condivisi devono essere esaminati: non sono certificabili dal repository. Nome/cognome/data emissione restano dati correnti del paziente, non una fotografia storica.
SQLSTATE gestiti senza esporre errori SQL: 42501 -> 403; 22023 -> 400; P0002 -> 404; 55P03/40P01/40001 -> 409 e richiesta di aggiornare/riprovare; errori non riconosciuti -> 503. Consultazione: token sconosciuto/revocato/scaduto tutti 404; problema tecnico 503. Una risposta persa dopo commit richiede un nuovo link, che invalida il precedente.
SQL usa primitive standard presenti in PostgreSQL 15/17; non richiede pgcrypto o altre estensioni. La versione remota e sconosciuta: provare sulla stessa major/minor. Controllare proconfig del path vuoto e della durata lock, proprietari e privilegi dopo il DDL. La migrazione non e ripetibile; collisioni portano a rollback. La fase AccessoCentrale non va rieseguita dopo questa migrazione.

## Ambiente di prova futuro

Usare un cluster PostgreSQL o Supabase locale completamente separato, senza URL/chiavi/env del progetto reale, con rete remota disabilitata. Non usare un semplice schema di prova nel database condiviso. Prima confrontare la versione PostgreSQL e uno schema solo strutturale revisionato. Nessun dato reale o copia di auth.users.
Preparare manualmente, soltanto nel cluster isolato, i ruoli anon/authenticated/service_role e auth.uid con la definizione compatibile Supabase, le tabelle sintetiche e le precondizioni AccessoCentrale (proprietari, RLS, policy e helper). Non applicare ciecamente tutte le migrazioni: quella AccessoCentrale richiede lo stato originale. Fixture con operatore A abilitato, B disabilitato, C senza riga; due pazienti P/Q con tessere diverse, paziente senza tessera, anno scaduto, anno futuro e valori limite. Usare UUID fissi sintetici e hash di test, mai token reali.
Eseguire in futuro la sola migrazione revisionata su quella istanza. Usare psql con ON_ERROR_STOP e connessione locale esplicita revisionata; nessun comando di esecuzione e stato lanciato in questa sessione.
Il file supabase/checks/tessera_pubblica_privilegi.sql e pronto per ricognizione sola lettura prima/dopo: nessuna chiamata RPC, solo cataloghi/definizioni. Controllare separatamente schemi esposti PostgREST, grant ereditati/default, oggetti alternativi e trigger.

## Matrice di collaudo SQL futura

1. Con ruolo authenticated e claim JWT A, chiamare crea(P,H1). Tornare al ruolo amministrativo: creato_da=A, numero/anno corretti, scade_il esattamente al primo gennaio successivo e non a 30 giorni. Ripetere con A/B/C, claim assente e JWT utente diverso: solo A autorizzato. Service_role/anon non devono poter chiamare crea o revoca.
2. Verificare auth.uid prima della RPC e creato_da dopo, anche dentro SECURITY DEFINER. Per simulare claim solo in fixture: BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"sub":"UUID_A_SINTETICO","role":"authenticated"}',true); SELECT set_config('request.jwt.claim.sub','UUID_A_SINTETICO',true); chiamata RPC; RESET ROLE; verifica amministrativa; ROLLBACK. Sostituire il segnaposto prima dell'uso. I claim impostati a mano provano il DB, non la validazione JWT: aggiungere prova HTTP PostgREST con token locali firmati.
3. Come service_role, leggere H1: una sola riga P e sei colonne; hash casuale, NULL, stringa malformata -> zero righe. Nessun ID da passare alla lettura. Come anon/authenticated: EXECUTE lettura negato. Nessun accesso diretto alle tabelle per anon; nessuna autoabilitazione operatori.
4. Revocare P: H1 non legge piu; Q resta leggibile. Rigenerare H2: H1 non legge e H2 legge. Rinnovo anno o cambio numero: H2 non legge; ripristino vecchi valori non lo riattiva. Hash duplicato tra P/Q: errore con rollback completo.
5. Modificare telefono/nome ed eseguire UPDATE numero=numero, anno=anno: H2 resta valido se non gia revocato. Cambiare davvero numero/anno: revoca. Testare rollback della transazione e controllare che i valori paziente non siano modificati dal trigger. Aggiungere in fixture un BEFORE trigger che cambi l'anno durante UPDATE telefono: la revoca deve avvenire.
6. Confrontare stampa interna e risposta pubblica con numero/anno noti. Provare data emissione NULL, date ISO, tipi effettivi e session TimeZone UTC/Europe/Rome; validita sempre calcolata in Europe/Rome. Se data_tesseramento e timestamptz, verificare e concordare il giorno civile da mostrare prima di applicare: il cast date eredita il fuso della sessione, come nel DDL precedente.
7. Verificare due istanti sintetici: '2026-12-31 23:59:59.999999 Europe/Rome' < make_timestamptz(2027,1,1,0,0,0,'Europe/Rome') e uguaglianza al termine -> non valido. Per provare la RPC reale a cavallo senza cambiare l'orologio host, usare una copia SOLO DI TEST della funzione con orologio iniettabile locale oppure un cluster con clock controllato. Non aggiungere parametri tempo alla RPC di produzione. Testare anche anno scaduto, 9998 e rigetto 9999.
8. Sessioni A/B READ COMMITTED, stesso P: A BEGIN + crea H1 senza commit; B crea H2 attende; A COMMIT -> B completa, solo H2 valido. Ripetere tenendo A oltre 5s: B errore 55P03, nessuna modifica parziale. Invertire con revoca e modifica numero/anno; la nuova lettura dopo ogni commit rispetta l'ordine. Provare anche revoca operatore durante l'attesa del lock.
9. Conflitti tra pazienti distinti e stessa coppia numero/anno: isolamento per paziente, non affidamento sull'unicita della numerazione. Il vecchio MAX+1 resta fuori ambito. Provare transazioni multi-paziente in ordine inverso: eventuale deadlock deve fare rollback ed essere gestito, non corrompere link.
10. ACL errata, schema USAGE mancante, proprietario senza bypass, FORCE RLS inatteso, default grant/inherited EXECUTE e collisioni nomi: il DDL deve fermarsi senza oggetti parziali. Provare ciascuna variante da un nuovo database fixture. Non concedere privilegi globali per aggirare gli errori.
11. Prova HTTP locale end-to-end: client senza login apre link, nessuna fetch generica a tabelle; solo API pubblica -> RPC limitata. Verificare header no-store, errori uniformi, assenza token/chiave privata nel bundle, log e referrer. Prova con service key mancante: 503 senza dati. Confermare che il client service non erediti Authorization utente.

Conservare esiti/SQLSTATE e snapshot cataloghi con sole fixture. Un esito positivo isolato non certifica i trigger, i privilegi o i consumer effettivi del progetto condiviso.

## Rischi residui prima dell'attivazione

Nessun collaudo SQL o controllo remoto e stato eseguito. Restano conferma tipi/owner/ACL/versione/schema esposto, prova PostgreSQL/PostgREST isolata e verifica trigger/consumer reali. I link ora durano potenzialmente tutto l'anno: chi li riceve puo leggere la tessera fino alla scadenza/revoca. Rate limiting condiviso nell'hosting e protezione della credenziale server restano necessari. Non si possono ritirare dati gia scaricati; richieste in corso possono completarsi. Stati di emissione, rinnovi e timestamp storici vanno verificati sui dati senza correzioni automatiche.

## Riferimenti verificati

- https://www.postgresql.org/docs/current/sql-createfunction.html (SECURITY DEFINER, proprietario, search_path e privilegi).
- https://www.postgresql.org/docs/current/functions-datetime.html (now/statement_timestamp/clock_timestamp).
- https://supabase.com/docs/guides/database/functions (privilegi funzione e definer).
- https://supabase.com/kb/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z (Authorization e client service separato).
