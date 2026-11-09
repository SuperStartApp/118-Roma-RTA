# Accesso sicuro centrale — Fase 1

Implementazione locale. Nessuna migrazione applicata al database remoto.

## Prima dell'applicazione manuale

1. Verificare di essere nel progetto Supabase corretto, quello già configurato nel gestionale. Non cambiare le impostazioni Auth globali o le tabelle `drive_*`.
2. Esaminare la migrazione completa `supabase/migrations/20261108000200_accesso_centrale.sql`. Richiede un amministratore; è transazionale e non ripetibile. Non usare un comando di migrazione globale che possa eseguire nuovamente lo script annullamenti/rimborsi, già applicato manualmente.
3. Eseguire `supabase/checks/accesso_centrale_dipendenze.sql`, di sola lettura. La migrazione controlla le tre policy confermate e interrompe l'operazione se trova policy inattese, viste dipendenti accessibili o funzioni `SECURITY DEFINER` accessibili collegate direttamente o indirettamente alle tre tabelle. Le routine estranee non bloccano automaticamente la migrazione. Le associazioni testuali possono includere commenti e omonimi: esaminare la definizione prima di concludere che esista un accesso effettivo. Nessuna funzione viene modificata o privata dei permessi.
4. `pg_depend` e la ricerca testuale non possono certificare SQL dinamico, riferimenti costruiti a runtime, schemi esposti dalla Data API o applicazioni esterne. Queste verifiche remote restano obbligatorie. Non esporre lo schema `roma_rta_private` nella Data API.
5. La RPC originale `genera_prossima_tessera(text, integer)` non viene modificata, inclusi i suoi privilegi. È `SECURITY INVOKER`: le letture delle tre tabelle restano soggette alle nuove RLS. Non è un'operazione da provare su dati reali durante il collaudo. `MAX + 1` può restituire numeri duplicati in concorrenza: limite esistente non corretto in questa fase.
6. Verificare eventuali default/sequenze richiesti dagli INSERT. Non vengono inventati nuovi GRANT a sequenze o oggetti di altri progetti.

La ricognizione separata mostra routine collegate, corpi con possibili istruzioni dinamiche, linguaggi esterni, viste, policy e permessi. SQL dinamico, codice esterno e nomi costruiti a runtime non sono certificabili dai cataloghi: la mancata segnalazione non prova la sicurezza. Legge definizioni, non dati applicativi. Controllare localmente eventuali segreti presenti nel vecchio codice SQL prima di condividere i risultati.

I GRANT/REVOKE riguardano soltanto le tre tabelle ROMA R.T.A. e i nuovi oggetti dedicati. Non modificano i ruoli globali o i default grant. Tuttavia un altro gestionale che usi proprio queste tre tabelle, direttamente o tramite RPC, risentira delle nuove autorizzazioni: confermare i consumatori esterni prima di applicare. Non e possibile dedurli interamente dai cataloghi PostgreSQL.

## Primo operatore (procedura amministrativa, non eseguita)

Solo dopo la revisione e l'applicazione manuale della migrazione:

1. In Supabase **Authentication → Users** creare un account email/password dell'operatore, oppure usare un account già esistente e verificato. Nessuna registrazione pubblica nell'app. Prima di creare account nel progetto condiviso, controllare eventuali trigger su `auth.users` che possano avere effetti sulle applicazioni esistenti. Non cambiare configurazioni Auth globali. Consegnare le credenziali tramite un canale appropriato, mai nel repository.
2. Copiare l'UUID dell'account dal pannello. Nel SQL Editor amministrativo sostituire il segnaposto seguente e abilitare esclusivamente quell'account:

```sql
-- Operazione amministrativa futura, NON eseguita dal codice o dai test.
INSERT INTO roma_rta_private.operatori_centrale (user_id, ruolo, abilitato)
VALUES ('SOSTITUIRE_CON_UUID_AUTH_REALE'::uuid, 'centrale', true);
```

Il segnaposto è intenzionalmente non valido. La chiave esterna richiede un account Auth esistente. L'INSERT non modifica pazienti, prenotazioni o autisti. La tabella operatori non è leggibile o modificabile dal client e non ha policy che consentano autoassegnazioni.

3. Aprire `/login` e accedere con email/password. La sessione viene verificata con Supabase Auth e il ruolo con `public.roma_rta_operatore_abilitato()`. Senza migrazione o con RPC non disponibile viene mostrato un errore di configurazione, senza montare le pagine operative.
4. Per revocare l'accesso, un amministratore esegue:

```sql
UPDATE roma_rta_private.operatori_centrale
SET abilitato = false
WHERE user_id = 'SOSTITUIRE_CON_UUID_AUTH_REALE'::uuid;
```

Le RLS consultano lo stato corrente a ogni nuova istruzione; la UI ricontrolla all'avvio, agli eventi Auth, al ritorno sulla scheda e ogni minuto visibile. Come per qualsiasi sistema, non si possono ritirare dati già visualizzati o scaricati.

## Comportamento applicativo

- Tutte le pagine operative e le tessere richiedono un operatore centrale abilitato. Il filtro React è una protezione della navigazione: la sicurezza dei dati dipende dalle RLS applicate nel database, anche contro richieste dirette.
- Il client usa la chiave pubblica e la sessione Supabase Auth; nessuna `service_role` è utilizzata. La persistenza dei token è gestita dall'SDK con la chiave dedicata `roma-rta-centrale-auth`: non si autorizza tramite ID/ruoli salvati manualmente in localStorage.
- Il logout è locale a questa sessione/dispositivo, non globale sugli altri dispositivi. Se fallisce, le pagine vengono nascoste e viene richiesto di riprovare.
- Nessun recupero password, signup o modifica globale Auth è introdotto. Il recupero dell'accesso è amministrativo in questa fase.
- `/autista` e `/autista/dashboard` mostrano la sospensione anche se è presente una sessione centrale. I PIN memorizzati non sono modificati; non viene interrogata la tabella autisti per autenticarsi.
- L'endpoint `/api/autista/conferma-incasso` resta invariato, inattivo e restituisce 503.
- I link tessera inviati in precedenza richiedono adesso l'accesso centrale. Il destinatario non autenticato non può leggere la tessera. La condivisione pubblica resta sospesa; non presentare i vecchi link come accessibili ai pazienti.
- Il codice operativo della dashboard autista è conservato per una fase successiva, ma non viene montato. Eventuali account Auth autista privi dell'abilitazione centrale sono esclusi dalle RLS di questa fase.

## Verifiche prima della pubblicazione

Su ambiente isolato o dati sintetici verificare a livello database:

1. Anon non può leggere né scrivere sulle tre tabelle, tramite accesso diretto o oggetti alternativi.
2. Account Auth non presente nella lista, disabilitato o appartenente a un altro progetto: nessun accesso alle righe, nessun INSERT/UPDATE consentito.
3. Operatore abilitato: lettura, INSERT e UPDATE necessari al gestionale; DELETE/TRUNCATE non concessi.
4. Nessun client può leggere o modificare la tabella operatori o autoabilitarsi.
5. Sessione scaduta/logout: pagine smontate; nuova autenticazione necessaria. Revoca operatore rispettata dalle nuove richieste anche prima del ricontrollo UI.
6. Join pazienti/autisti, ricerca paziente, INSERT con default, numerazione tessera e annullamenti/rimborsi compatibili con le nuove autorizzazioni.
7. Nessuna regressione sugli altri progetti e nessuna esposizione da viste, funzioni, copie materializzate o schemi alternativi.

I test locali utilizzano mock Auth/RPC e rendering React, senza chiamate Supabase. I controlli testuali sullo script non sostituiscono un'esecuzione PostgreSQL isolata o il collaudo delle RLS effettive. Non è stato installato un database locale né sono state applicate migrazioni remote.


## Estensione tessera pubblica (proposta successiva)

La pagina /tessera-pubblica e le nuove API sono descritte in [tessera-pubblica-avviso-autista.md](tessera-pubblica-avviso-autista.md). Le tessere interne /tessera/<id> restano protette. La nuova migrazione separata non risulta applicata da questa sessione; questa guida documenta la precedente Fase 1.
