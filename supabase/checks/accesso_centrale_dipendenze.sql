-- SOLA LETTURA: eseguire manualmente PRIMA della migrazione accesso centrale.
-- Non legge righe di pazienti/prenotazioni/autisti o di auth.users.
-- Le definizioni potrebbero contenere vecchi segreti hardcoded: esaminarle
-- localmente prima di condividere l'output. Nessuna routine viene eseguita.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- 1. Routine direttamente/indirettamente collegate: stessa ricerca mirata
-- della migrazione, ma mostra anche SECURITY INVOKER e definizioni da esaminare.
WITH RECURSIVE relazioni(oid) AS (
  SELECT c.oid FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('pazienti', 'prenotazioni', 'autisti')
  UNION
  SELECT rw.ev_class FROM relazioni rel
  JOIN pg_catalog.pg_depend d ON d.refclassid = 'pg_class'::regclass
    AND d.refobjid = rel.oid AND d.classid = 'pg_rewrite'::regclass
  JOIN pg_catalog.pg_rewrite rw ON rw.oid = d.objid
), routine AS MATERIALIZED (
  SELECT p.oid, p.proname, p.prosecdef, p.prosrc,
    lower(regexp_replace(p.prosrc, '[[:space:]"]', '', 'g')) AS corpo_normalizzato
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname !~ '^pg_toast'
), funzioni_collegate(oid) AS (
  SELECT p.oid FROM routine p
  WHERE EXISTS (
    SELECT 1 FROM pg_catalog.pg_depend d
    WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
      AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid IN (SELECT oid FROM relazioni)
  ) OR EXISTS (
    SELECT 1 FROM relazioni rel JOIN pg_catalog.pg_class c ON c.oid = rel.oid
    WHERE strpos(lower(p.prosrc), lower(c.relname)) > 0
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgfoid = p.oid
      AND t.tgrelid IN (SELECT oid FROM relazioni)
  )
  UNION
  SELECT chiamante.oid FROM funzioni_collegate f
  JOIN routine chiamata ON chiamata.oid = f.oid
  JOIN routine chiamante ON EXISTS (
    SELECT 1 FROM pg_catalog.pg_depend d
    WHERE d.classid = 'pg_proc'::regclass AND d.objid = chiamante.oid
      AND d.refclassid = 'pg_proc'::regclass AND d.refobjid = chiamata.oid
  ) OR strpos(chiamante.corpo_normalizzato, lower(chiamata.proname) || '(') > 0
)
SELECT
  p.oid::regprocedure AS firma,
  pg_get_userbyid(p.proowner) AS proprietario,
  p.prosecdef AS security_definer,
  p.proconfig AS configurazione,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  pg_get_functiondef(p.oid) AS definizione
FROM funzioni_collegate f JOIN pg_catalog.pg_proc p ON p.oid = f.oid
ORDER BY p.oid::regprocedure::text;

-- 2. Zone non certificabili dalla ricerca sopra: indizi NON ESAUSTIVI di
-- SQL dinamico (EXECUTE, composizione stringhe, esecutori indiretti) e linguaggi
-- esterni. NON sono automaticamente vulnerabilita o dipendenze da ROMA R.T.A.
-- Verificare le destinazioni costruite a runtime e i chiamanti privilegiati.
-- Include routine senza EXECUTE al client: un wrapper/trigger SECURITY DEFINER
-- potrebbe richiamarle con i privilegi del proprio proprietario.
-- Nessuna riga trovata NON prova l'assenza di percorsi alternativi.
SELECT
  p.oid::regprocedure AS firma,
  l.lanname AS linguaggio,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS proprietario,
  p.proconfig AS configurazione,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  pg_get_functiondef(p.oid) AS definizione
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE p.prokind IN ('f', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname !~ '^pg_toast'
  AND (
    p.prosrc ~* '\m(execute|format|query_to_xml|query_to_xmlschema|dblink|dblink_exec)\M'
    OR strpos(p.prosrc, '||') > 0
    OR l.lanname NOT IN ('sql', 'plpgsql')
  )
ORDER BY p.oid::regprocedure::text;

-- 3. Viste dipendenti: proprietario, security_invoker e privilegi effettivi.
WITH RECURSIVE relazioni(oid) AS (
  SELECT c.oid FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('pazienti', 'prenotazioni', 'autisti')
  UNION
  SELECT rw.ev_class FROM relazioni rel
  JOIN pg_catalog.pg_depend d ON d.refclassid = 'pg_class'::regclass
    AND d.refobjid = rel.oid AND d.classid = 'pg_rewrite'::regclass
  JOIN pg_catalog.pg_rewrite rw ON rw.oid = d.objid
)
SELECT c.oid::regclass AS vista, c.relkind, c.reloptions,
  pg_get_userbyid(c.relowner) AS proprietario,
  r.rolname,
  has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS privilegi_tabella,
  has_any_column_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE') AS privilegi_colonne,
  pg_get_viewdef(c.oid, true) AS definizione
FROM relazioni rel JOIN pg_catalog.pg_class c ON c.oid = rel.oid
CROSS JOIN pg_catalog.pg_roles r
WHERE c.relkind IN ('v', 'm') AND r.rolname IN ('anon', 'authenticated')
ORDER BY c.oid::regclass::text, r.rolname;

-- 4. Policy e ACL effettive delle sole tre tabelle; nessun dato applicativo.
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('pazienti', 'prenotazioni', 'autisti')
ORDER BY tablename, policyname;

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, r.rolname,
  pg_get_userbyid(c.relowner) AS proprietario,
  has_table_privilege(r.oid, c.oid, 'SELECT') AS lettura,
  has_table_privilege(r.oid, c.oid, 'INSERT') AS inserimento,
  has_table_privilege(r.oid, c.oid, 'UPDATE') AS modifica,
  has_table_privilege(r.oid, c.oid, 'DELETE') AS eliminazione,
  has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS svuotamento,
  has_any_column_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES') AS privilegi_colonne
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_catalog.pg_roles r
WHERE n.nspname = 'public'
  AND c.relname IN ('pazienti', 'prenotazioni', 'autisti')
  AND r.rolname IN ('anon', 'authenticated')
ORDER BY c.relname, r.rolname;

ROLLBACK;
