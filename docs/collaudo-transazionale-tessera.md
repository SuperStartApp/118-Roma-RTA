# Prova transazionale DDL tessera pubblica - preparata, non eseguita

File separato: `supabase/checks/tessera_pubblica_transazionale.sql`.
La migrazione originale non viene modificata. Nessuna connessione remota e nessuna esecuzione SQL sono state effettuate per preparare questi file.

## Cosa fa

Riproduce i controlli e il DDL della migrazione in un unico blocco DO. Le istruzioni originali sono racchiuse in stringhe SQL ed eseguite in ordine, senza il controllo transazione originale. Nessuna RPC viene invocata: INSERT/UPDATE/SELECT sui pazienti presenti nei corpi funzione sono solo definizioni, non istruzioni eseguite durante questa prova.

Non genera token, non legge righe di pazienti/operatori e non inserisce pazienti sintetici nel database condiviso. Interroga soltanto cataloghi e metadati. Crea temporaneamente gli oggetti ROMA R.T.A. e i relativi ACL/trigger: non cambia tabelle, ruoli o autorizzazioni degli altri progetti.

Al termine del DDL solleva intenzionalmente SQLSTATE ZT001 e lo intercetta fuori dal sottoblocco. PostgreSQL annulla il sottoblocco prima di proseguire; il messaggio NOTICE indica solo l'esito dei controlli DDL. Il file termina inoltre con ROLLBACK. Anche omettere accidentalmente l'ultima riga non conserva il DDL dopo il completamento del DO. Non esistono istruzioni di conferma transazione nel file.

Errori inattesi e timeout non vengono ignorati: abortiscono la transazione. In quel caso occorre eseguire ROLLBACK nella stessa connessione o chiuderla; non continuare con altri comandi. Non aggiungere handler generici che ignorino gli errori.

## Protezioni e impatto sul database condiviso

- `lock_timeout = 1s`, `statement_timeout = 10s`, `idle_in_transaction_session_timeout = 15s`, tutti SET LOCAL. Il timeout statement copre l'intero DO, non soltanto una singola istruzione DDL interna. I timeout di 5s nelle definizioni originali delle funzioni restano invariati: quelle funzioni non vengono chiamate.
- Prima di qualsiasi DDL rifiuta tutti gli event trigger abilitati, anche di replica. Event trigger preesistenti possono chiamare servizi esterni o sequenze: il rollback SQL non garantisce l'annullamento di questi effetti. Non vengono disabilitati e non esistono eccezioni automatiche per quelli standard Supabase. Su Supabase il blocco potrebbe quindi impedire la prova: fermarsi, non aggirarlo.
- Non eseguire contemporaneamente modifiche amministrative a event trigger, ruoli o oggetti interessati. Il controllo cataloghi non impedisce a un altro amministratore di modificarli durante la prova; non costituisce una certificazione di un ambiente remoto sconosciuto.
- I lock sulla tabella pazienti (anche quelli presi per FK e trigger) possono bloccare brevemente scritture di qualsiasi applicazione che la utilizzi. Il rollback non elimina il tempo di attesa gia subito. Scegliere una finestra a basso traffico. Nessuna garanzia di impatto operativo nullo.
- L'esecuzione e gli errori possono comparire nei log amministrativi. Il rollback annulla gli oggetti e gli ACL transazionali, non i log o ogni effetto esterno ipotetico del server. Il file non effettua chiamate esterne, non chiama nextval/setval e non altera configurazioni globali.

## Modalita di eventuale esecuzione futura

Non e un'autorizzazione all'esecuzione. Prima usare la ricognizione in sola lettura e verificare progetto, AccessoCentrale, proprietari, tipi, trigger e consumer delle tabelle. La prova non applica AccessoCentrale mancante e non aggira precondizioni o collisioni.

Usare una connessione/sessione amministrativa dedicata senza altre transazioni o modifiche pendenti. Eseguire il file completo in una sola operazione; non selezionare frammenti interni o estrarre il DDL dalle stringhe. L'uso di una sessione dedicata evita di annullare accidentalmente lavoro precedente con il ROLLBACK finale. Verificare che il client mostri i NOTICE. Se compaiono errori, fermarsi ed effettuare il rollback sulla stessa connessione; se non e possibile mantenerla, chiuderla e verificare successivamente i cataloghi.

Esito positivo atteso: NOTICE con controlli completati e sottoblocco annullato, seguito dal rollback finale. L'assenza di messaggi non prova il successo. Dopo la prova verificare con `tessera_pubblica_privilegi.sql` che gli oggetti nuovi non siano presenti e che i privilegi preesistenti siano invariati. Nessun dato da condividere, nessuna chiave privata necessaria per questa prova SQL.

## Cosa verifica e cosa no

Verifica realmente, se eseguita e completata sul database: precondizioni AccessoCentrale della migrazione, disponibilita dei tipi/oggetti referenziati durante DDL, possibilita di creare gli oggetti, compilazione/validazione iniziale delle definizioni, creazione FK/CHECK/trigger, ACL risultanti e controlli finali della migrazione. Il rollback annulla poi il DDL. I CHECK non sono esercitati su righe e PL/pgSQL puo rinviare la pianificazione di istruzioni alla prima chiamata: non e un test di tutti i corpi RPC.

Non verifica: JWT reali e auth.uid durante RPC, emissione/rotazione/revoca, dati e vincoli su righe, comportamento del trigger in UPDATE, scadenza a Capodanno, serializzazione con due sessioni, RLS tramite PostgREST e richieste HTTP, link WhatsApp, stampa/PDF, protezione della service key e comportamento del browser. Non verifica i consumer esterni di altre applicazioni.

Queste prove funzionali richiedono un collaudo applicativo successivo con un piano e dati sintetici dedicati, mai pazienti reali. Sul database condiviso non vanno improvvisate fixture o utenti Auth: occorre autorizzare separatamente eventuali dati sintetici e valutarne trigger/effetti condivisi. Gli oggetti di questa prova non sono visibili alle altre sessioni prima del rollback, quindi non possono essere usati dal browser per una prova end-to-end.

## Verifica locale della copia

`scripts/prepara-collaudo-tessera.mjs` genera soltanto il file SQL e ne registra SHA256 della fonte; non esegue SQL e non usa credenziali. I test `tests/tessera-transazionale.test.mjs` confrontano ogni istruzione copiata con la fonte, controllano i confini della transazione, l'assenza di conferme, l'annullamento obbligatorio, i timeout e la mancata invocazione delle RPC. Sono verifiche statiche locali, non risultati PostgreSQL.

Riferimenti: [PostgreSQL: blocchi EXCEPTION](https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING), [event trigger](https://www.postgresql.org/docs/current/event-trigger-definition.html), [timeout](https://www.postgresql.org/docs/current/runtime-config-client.html).
