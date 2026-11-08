-- ROMA R.T.A. - Fase 1. PROPOSTA LOCALE, NON ESEGUITA.
-- Eseguire manualmente come amministratore solo dopo la ricognizione remota.
-- Non modifica dati, RPC esistenti, impostazioni Auth o tabelle drive_*.
-- Migrazione intenzionalmente non ripetibile: collisioni => rollback completo.
-- I controlli su funzioni/viste sono conservativi: non rimuovere un blocco
-- senza esaminare l'oggetto indicato e i suoi utilizzi negli altri progetti.
-- pg_depend e ricerche testuali non provano l'assenza di SQL dinamico indiretto.
-- Prima dell'esecuzione usare supabase/checks/accesso_centrale_dipendenze.sql:
-- nessuna assenza di risultati costituisce una certificazione del database.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Mantiene stabile l'insieme delle policy delle sole tre tabelle durante il DDL.
LOCK TABLE public.pazienti, public.prenotazioni, public.autisti
  IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  tab text;
  problema text;
BEGIN
  IF to_regnamespace('roma_rta_private') IS NOT NULL
     OR to_regprocedure('public.roma_rta_operatore_abilitato()') IS NOT NULL THEN
    RAISE EXCEPTION 'Nomi ROMA R.T.A. gia presenti: verificare prima di applicare';
  END IF;

  FOREACH tab IN ARRAY ARRAY['pazienti', 'prenotazioni', 'autisti'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tab
        AND c.relkind = 'r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Tabella public.% assente, non ordinaria o RLS non attiva', tab;
    END IF;

    IF (SELECT count(*) FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = tab) <> 1
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_policies
         WHERE schemaname = 'public' AND tablename = tab
           AND policyname = 'Permetti tutto a tutti per ora'
           AND permissive = 'PERMISSIVE' AND cmd = 'ALL'
           AND roles = ARRAY['public']::name[]
           AND qual = 'true' AND with_check = 'true'
       ) THEN
      RAISE EXCEPTION 'Policy inattese su public.%: migrazione interrotta, serve nuova ricognizione', tab;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
             WHERE rolname IN ('anon', 'authenticated')
               AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Ruolo applicativo privilegiato: verificare configurazione';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_inherits i
    WHERE i.inhrelid IN ('public.pazienti'::regclass, 'public.prenotazioni'::regclass, 'public.autisti'::regclass)
       OR i.inhparent IN ('public.pazienti'::regclass, 'public.prenotazioni'::regclass, 'public.autisti'::regclass)
  ) THEN
    RAISE EXCEPTION 'Ereditarieta o partizioni presenti: verificare anche gli accessi alle relazioni collegate';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname = 'public'
      AND c.relname IN ('pazienti', 'prenotazioni', 'autisti')
      AND r.rolname IN ('anon', 'authenticated')
      AND pg_catalog.pg_has_role(r.oid, c.relowner, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'Ruolo applicativo membro del proprietario delle tabelle';
  END IF;

  -- Blocca viste accessibili dipendenti dalle tabelle, anche attraverso altre viste.
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
  SELECT string_agg(c.oid::regclass::text, ', ') INTO problema
  FROM relazioni rel JOIN pg_catalog.pg_class c ON c.oid = rel.oid
  WHERE c.relkind IN ('v', 'm') AND (
    has_table_privilege('anon', c.oid, 'SELECT')
    OR has_any_column_privilege('anon', c.oid, 'SELECT')
    OR has_table_privilege('authenticated', c.oid, 'SELECT')
    OR has_any_column_privilege('authenticated', c.oid, 'SELECT')
    OR has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE')
    OR has_any_column_privilege('anon', c.oid, 'INSERT,UPDATE')
    OR has_any_column_privilege('authenticated', c.oid, 'INSERT,UPDATE')
  );
  IF problema IS NOT NULL THEN
    RAISE EXCEPTION 'Viste da verificare prima del rilascio: %', problema;
  END IF;

  -- Cerca soltanto routine collegate alle tre tabelle o alle viste dipendenti.
  -- Integra pg_depend con indizi testuali per corpi SQL/PLpgSQL non tracciati.
  -- Risale ai chiamanti, anche SECURITY DEFINER di altri schemi: un wrapper
  -- privilegiato potrebbe aggirare RLS tramite una funzione SECURITY INVOKER.
  -- I nomi nel testo sono indizi (anche commenti/omonimi), non un parser SQL.
  -- Le routine estranee non bloccano la migrazione; SQL dinamico e linguaggi
  -- esterni richiedono la ricognizione manuale separata, senza presumerli sicuri.
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
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO problema
  FROM funzioni_collegate f JOIN routine p ON p.oid = f.oid
  WHERE p.prosecdef AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );
  IF problema IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER accessibili non ancora verificate sulle tre tabelle (dipendenze o indizi testuali): %. Nessuna modifica applicata', problema;
  END IF;
  RAISE NOTICE 'Verifica statica mirata completata. Prima di applicare, esaminare separatamente SQL dinamico, funzioni esterne e utilizzi condivisi: vedere supabase/checks/accesso_centrale_dipendenze.sql';

  -- Un trigger puo eseguire una funzione privilegiata anche senza un GRANT
  -- EXECUTE attuale al chiamante: non basta l'inventario delle RPC esposte.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO problema
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal AND p.prosecdef
    AND t.tgrelid IN ('public.pazienti'::regclass, 'public.prenotazioni'::regclass, 'public.autisti'::regclass);
  IF problema IS NOT NULL THEN
    RAISE EXCEPTION 'Trigger SECURITY DEFINER da verificare: %', problema;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = to_regprocedure('public.genera_prossima_tessera(text,integer)')
      AND p.prokind = 'f' AND NOT p.prosecdef
  ) THEN
    RAISE EXCEPTION 'RPC tessera assente o non SECURITY INVOKER: verificare';
  END IF;
END;
$$;

CREATE SCHEMA roma_rta_private;
REVOKE ALL ON SCHEMA roma_rta_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA roma_rta_private TO authenticated;

CREATE TABLE roma_rta_private.operatori_centrale (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ruolo text NOT NULL DEFAULT 'centrale' CHECK (ruolo = 'centrale'),
  abilitato boolean NOT NULL DEFAULT false
);
REVOKE ALL ON TABLE roma_rta_private.operatori_centrale
  FROM PUBLIC, anon, authenticated;
ALTER TABLE roma_rta_private.operatori_centrale ENABLE ROW LEVEL SECURITY;
-- Nessuna policy e nessun GRANT al client: niente lettura o autoassegnazione.
-- Il proprietario amministrativo accede per abilitare/revocare gli operatori.

CREATE FUNCTION roma_rta_private.operatore_abilitato()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM roma_rta_private.operatori_centrale o
    WHERE o.user_id = (SELECT auth.uid())
      AND o.ruolo = 'centrale' AND o.abilitato IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION roma_rta_private.operatore_abilitato()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION roma_rta_private.operatore_abilitato()
  TO authenticated;

-- Unico endpoint RPC nuovo: restituisce soltanto l'autorizzazione del chiamante.
-- Non accetta ID dal browser. Non espone la lista operatori.
CREATE FUNCTION public.roma_rta_operatore_abilitato()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$ SELECT roma_rta_private.operatore_abilitato(); $$;
REVOKE ALL ON FUNCTION public.roma_rta_operatore_abilitato()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roma_rta_operatore_abilitato()
  TO authenticated;

DO $$
DECLARE
  tab text;
  col text;
BEGIN
  IF has_table_privilege('anon', 'roma_rta_private.operatori_centrale', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('authenticated', 'roma_rta_private.operatori_centrale', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_any_column_privilege('anon', 'roma_rta_private.operatori_centrale', 'SELECT,INSERT,UPDATE,REFERENCES')
     OR has_any_column_privilege('authenticated', 'roma_rta_private.operatori_centrale', 'SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'Privilegi residui sulla tabella operatori: verificare grant predefiniti o ereditati';
  END IF;
  FOREACH tab IN ARRAY ARRAY['pazienti', 'prenotazioni', 'autisti'] LOOP
    EXECUTE format('DROP POLICY %I ON public.%I',
      'Permetti tutto a tutti per ora', tab);

    -- Nessun privilegio anonimo; elimina anche concessioni a PUBLIC.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', tab);
    EXECUTE format('REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM authenticated', tab);
    -- Le concessioni sulle colonne sopravvivono ai REVOKE di tabella.
    FOR col IN
      SELECT a.attname FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = format('public.%I', tab)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
    LOOP
      EXECUTE format('REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.%2$I FROM PUBLIC, anon', col, tab);
      EXECUTE format('REVOKE REFERENCES (%I) ON TABLE public.%I FROM authenticated', col, tab);
    END LOOP;

    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO authenticated', tab);
    EXECUTE format('CREATE POLICY roma_rta_lettura ON public.%I FOR SELECT TO authenticated USING ((SELECT roma_rta_private.operatore_abilitato()))', tab);
    EXECUTE format('CREATE POLICY roma_rta_inserimento ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT roma_rta_private.operatore_abilitato()))', tab);
    EXECUTE format('CREATE POLICY roma_rta_modifica ON public.%I FOR UPDATE TO authenticated USING ((SELECT roma_rta_private.operatore_abilitato())) WITH CHECK ((SELECT roma_rta_private.operatore_abilitato()))', tab);
    -- Difesa aggiuntiva: future policy permissive non devono allargare il ruolo.
    EXECUTE format('CREATE POLICY roma_rta_limite_operatore ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT roma_rta_private.operatore_abilitato())) WITH CHECK ((SELECT roma_rta_private.operatore_abilitato()))', tab);
  END LOOP;
END;
$$;

-- Controlli finali: eventuali privilegi ereditati imprevisti fanno rollback.
DO $$
DECLARE
  tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['pazienti', 'prenotazioni', 'autisti'] LOOP
    IF has_table_privilege('anon', format('public.%I', tab), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('anon', format('public.%I', tab), 'SELECT,INSERT,UPDATE,REFERENCES')
       OR has_table_privilege('authenticated', format('public.%I', tab), 'DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('authenticated', format('public.%I', tab), 'REFERENCES') THEN
      RAISE EXCEPTION 'Privilegi residui inattesi su public.%: verificare ruoli ereditati', tab;
    END IF;
    IF (SELECT count(*) FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = tab) <> 4 THEN
      RAISE EXCEPTION 'Numero policy inatteso su public.%', tab;
    END IF;
  END LOOP;
END;
$$;

-- Nessuna modifica a public.genera_prossima_tessera(text, integer).
-- Resta SECURITY INVOKER: i SELECT sulle tabelle sono soggetti alle nuove RLS.
-- MAX + 1 NON garantisce unicita in concorrenza; limite originale invariato.
COMMIT;
