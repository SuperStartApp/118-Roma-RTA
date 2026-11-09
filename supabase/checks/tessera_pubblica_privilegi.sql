-- SOLA LETTURA, NON ESEGUITO. Ricognizione prima/dopo su istanza isolata.
-- Non legge dati applicativi, non chiama RPC, non applica migrazioni.
-- Le definizioni possono contenere vecchi segreti: esaminarle localmente.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_setting('server_version') AS versione_postgresql, current_user AS esecutore;
SELECT r.rolname, r.rolsuper, r.rolbypassrls, n.nspname,
  has_schema_privilege(r.oid, n.oid, 'USAGE') AS uso_schema,
  has_schema_privilege(r.oid, n.oid, 'CREATE') AS crea_schema
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_namespace n
WHERE r.rolname IN ('anon', 'authenticated', 'service_role', current_user)
  AND n.nspname IN ('public', 'roma_rta_private');
SELECT c.oid::regclass AS tabella, pg_get_userbyid(c.relowner) AS proprietario,
  c.relrowsecurity, c.relforcerowsecurity, r.rolname,
  has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS almeno_un_privilegio_tabella,
  has_any_column_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES') AS almeno_un_privilegio_colonna
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_catalog.pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
  AND ((n.nspname = 'public' AND c.relname IN ('pazienti', 'prenotazioni', 'autisti'))
    OR (n.nspname = 'roma_rta_private' AND c.relname IN ('operatori_centrale', 'tessere_condivisioni')));
SELECT p.oid::regprocedure AS funzione, pg_get_userbyid(p.proowner) AS proprietario,
  p.prosecdef, p.provolatile, p.proconfig, p.proacl, r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') AS eseguibile
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_catalog.pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
  AND ((n.nspname = 'public' AND p.proname IN ('roma_rta_operatore_abilitato', 'roma_rta_condividi_tessera', 'roma_rta_revoca_tessera', 'roma_rta_leggi_tessera'))
    OR (n.nspname = 'roma_rta_private' AND p.proname IN ('operatore_abilitato', 'revoca_tessera_modificata')));
SELECT p.oid::regprocedure AS funzione, pg_get_functiondef(p.oid) AS definizione
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'auth' AND p.proname = 'uid')
  OR (n.nspname = 'roma_rta_private' AND p.proname IN ('operatore_abilitato', 'revoca_tessera_modificata'))
  OR (n.nspname = 'public' AND p.proname IN ('roma_rta_condividi_tessera', 'roma_rta_revoca_tessera', 'roma_rta_leggi_tessera'));
SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS tipo
FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'pazienti' AND a.attnum > 0 AND NOT a.attisdropped
  AND a.attname IN ('id', 'numero_tessera', 'anno_tessera', 'data_tesseramento');
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definizione
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'pazienti' AND NOT t.tgisinternal;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies WHERE (schemaname = 'public' AND tablename IN ('pazienti', 'prenotazioni', 'autisti'))
  OR schemaname = 'roma_rta_private';
-- Rivedere anche ruoli ereditati, schemi esposti PostgREST, default ACL, trigger
-- esterni, event trigger e consumer di altri progetti: assenza risultati != sicurezza.
ROLLBACK;
