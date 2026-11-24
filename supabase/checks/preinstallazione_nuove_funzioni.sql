-- Unico SELECT di sola lettura. Eseguire nel ruolo amministrativo nel SQL Editor.
WITH requisiti(oggetto, presente) AS (VALUES
  ('public.pazienti', to_regclass('public.pazienti') IS NOT NULL),
  ('public.prenotazioni', to_regclass('public.prenotazioni') IS NOT NULL),
  ('public.autisti', to_regclass('public.autisti') IS NOT NULL),
  ('auth.uid()', to_regprocedure('auth.uid()') IS NOT NULL),
  ('controllo operatore', to_regprocedure('roma_rta_private.operatore_abilitato()') IS NOT NULL),
  ('operatori centrale', to_regclass('roma_rta_private.operatori_centrale') IS NOT NULL),
  ('RPC precedente tessere', to_regprocedure('public.genera_prossima_tessera(text,integer)') IS NOT NULL),
  ('condivisione tessere', to_regclass('roma_rta_private.tessere_condivisioni') IS NOT NULL),
  ('credenziali autisti', to_regclass('roma_rta_private.autista_credenziali') IS NOT NULL),
  ('sessioni autisti', to_regclass('roma_rta_private.autista_sessioni') IS NOT NULL),
  ('login autisti', to_regprocedure('public.roma_rta_autista_login(text,text,text)') IS NOT NULL),
  ('verifica sessione autisti', to_regprocedure('public.roma_rta_autista_sessione(text)') IS NOT NULL),
  ('ruoli Supabase', (SELECT count(*) = 3 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')))
),
colonne(tabella, nome, tipi) AS (
  SELECT 'pazienti', x, ARRAY['uuid'] FROM unnest(ARRAY['id']) x UNION ALL
  SELECT 'pazienti', x, ARRAY['smallint','integer','bigint'] FROM unnest(ARRAY['numero_tessera','anno_tessera']) x UNION ALL
  SELECT 'pazienti', 'data_tesseramento', ARRAY['date','timestamp without time zone','timestamp with time zone'] UNION ALL
  SELECT 'autisti', 'id', ARRAY['uuid'] UNION ALL
  SELECT 'autisti', 'attivo', ARRAY['boolean'] UNION ALL
  SELECT 'prenotazioni', x, ARRAY['uuid'] FROM unnest(ARRAY['id','autista_id','paziente_id']) x UNION ALL
  SELECT 'prenotazioni', 'data_appuntamento', ARRAY['date','timestamp without time zone','timestamp with time zone'] UNION ALL
  SELECT 'prenotazioni', 'costo', ARRAY['numeric','real','double precision','integer','bigint'] UNION ALL
  SELECT 'prenotazioni', 'pagato', ARRAY['boolean'] UNION ALL
  SELECT 'prenotazioni', x, ARRAY['timestamp with time zone','timestamp without time zone'] FROM unnest(ARRAY[
    'annullata_il','rimborso_effettuato_il','ora_inizio_effettiva','ora_fine_effettiva'
  ]) x UNION ALL
  SELECT 'prenotazioni', x, NULL::text[] FROM unnest(ARRAY[
    'ora_appuntamento','serve_ossigeno','serve_medico','note','partenza_citta','partenza_via','partenza_civico',
    'partenza_piano','partenza_interno','partenza_ascensore','partenza_dettagli_ospedale','arrivo_citta','arrivo_via',
    'arrivo_civico','arrivo_piano','arrivo_interno','arrivo_ascensore','arrivo_dettagli_ospedale',
    'ore_incluse','costo_ora_supplementare','metodo_pagamento'
  ]) x
),
collisioni(oggetto, presente) AS (VALUES
  ('oggetti tessere', to_regclass('roma_rta_private.tessere_config') IS NOT NULL OR to_regclass('roma_rta_private.tessere_progressivi') IS NOT NULL OR to_regprocedure('roma_rta_private.numerazione_tessera()') IS NOT NULL),
  ('oggetti autisti', to_regclass('public.roma_rta_prenotazioni_autisti') IS NOT NULL OR to_regprocedure('roma_rta_private.sincronizza_autista_principale()') IS NOT NULL OR to_regprocedure('public.roma_rta_assegna_autisti(uuid,uuid[])') IS NOT NULL OR to_regprocedure('public.roma_rta_crea_prenotazione(uuid,jsonb,uuid[])') IS NOT NULL OR to_regprocedure('public.roma_rta_registra_ora(uuid,uuid,text)') IS NOT NULL OR EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.prenotazioni') AND NOT attisdropped AND attname IN ('inizio_registrato_da','fine_registrata_da')
  )),
  ('oggetti ricevute', to_regclass('public.roma_rta_ricevute') IS NOT NULL OR to_regclass('roma_rta_private.ricevute_config') IS NOT NULL OR to_regclass('roma_rta_private.ricevute_progressivi') IS NOT NULL OR to_regprocedure('public.roma_rta_config_ricevute()') IS NOT NULL OR to_regprocedure('public.roma_rta_emetti_ricevuta(uuid,text,text,text,text,numeric,text,date,text,jsonb,jsonb)') IS NOT NULL)
),
colonne_verificate AS (
  SELECT c.*, a.attnum, format_type(a.atttypid, NULL) AS tipo,
    a.attnum IS NOT NULL AND (tipi IS NULL OR format_type(a.atttypid, NULL) = ANY(tipi)) AS ok
  FROM colonne c LEFT JOIN pg_attribute a ON a.attrelid = to_regclass('public.' || c.tabella)
    AND a.attname = c.nome AND a.attnum > 0 AND NOT a.attisdropped
),
tabelle AS (
  SELECT nome, to_regclass('public.' || nome) AS oid
  FROM (VALUES ('pazienti'), ('prenotazioni'), ('autisti')) v(nome)
),
funzioni(nome, definer, ruolo, anon_vietato) AS (VALUES
  ('roma_rta_private.operatore_abilitato()', true, 'authenticated', true),
  ('public.roma_rta_operatore_abilitato()', false, 'authenticated', true),
  ('public.genera_prossima_tessera(text,integer)', false, 'authenticated', false),
  ('public.roma_rta_autista_login(text,text,text)', true, 'service_role', true),
  ('public.roma_rta_autista_sessione(text)', true, 'service_role', true),
  ('public.roma_rta_autista_logout(text)', true, 'service_role', true)
),
-- SQL costante e aggregato, eseguito solo se le relazioni e le colonne sono disponibili.
dati AS MATERIALIZED (
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM colonne_verificate WHERE tabella = 'pazienti'
         AND nome IN ('numero_tessera','anno_tessera') AND NOT ok)
         AND has_table_privilege(to_regclass('public.pazienti'), 'SELECT')
         AND NOT row_security_active(to_regclass('public.pazienti'))
    THEN query_to_xml($sql$
      SELECT count(*) AS emesse, min(numero_tessera) AS minimo, max(numero_tessera) AS massimo,
        count(*) FILTER (WHERE anno_tessera IS NULL) AS senza_anno,
        count(*) FILTER (WHERE numero_tessera = 500 AND (anno_tessera = 2026 OR anno_tessera IS NULL)) AS occupate_500,
        count(*) FILTER (WHERE numero_tessera = 1 AND (anno_tessera >= 2027 OR anno_tessera IS NULL)) AS occupate_1,
        (SELECT count(*) FROM (
          SELECT anno_tessera, numero_tessera FROM public.pazienti WHERE numero_tessera > 0
          GROUP BY anno_tessera, numero_tessera HAVING count(*) > 1
        ) d) AS duplicati
      FROM public.pazienti WHERE numero_tessera > 0
    $sql$, false, false, '') END AS tessere,
    CASE WHEN NOT EXISTS (SELECT 1 FROM colonne_verificate WHERE
          ((tabella = 'prenotazioni' AND nome = 'autista_id') OR (tabella = 'autisti' AND nome = 'id')) AND NOT ok)
         AND has_table_privilege(to_regclass('public.prenotazioni'), 'SELECT')
         AND has_table_privilege(to_regclass('public.autisti'), 'SELECT')
         AND NOT row_security_active(to_regclass('public.prenotazioni'))
         AND NOT row_security_active(to_regclass('public.autisti'))
    THEN query_to_xml($sql$
      SELECT count(*) AS assegnate, count(*) FILTER (WHERE a.id IS NULL) AS orfane
      FROM public.prenotazioni p LEFT JOIN public.autisti a ON a.id = p.autista_id
      WHERE p.autista_id IS NOT NULL
    $sql$, false, false, '') END AS autisti
),
conteggi AS (
  SELECT tessere, autisti,
    ((xpath('/table/row/emesse/text()', tessere))[1])::text AS emesse,
    ((xpath('/table/row/minimo/text()', tessere))[1])::text AS minimo,
    ((xpath('/table/row/massimo/text()', tessere))[1])::text AS massimo,
    ((xpath('/table/row/senza_anno/text()', tessere))[1])::text AS senza_anno,
    ((xpath('/table/row/occupate_500/text()', tessere))[1])::text AS occupate_500,
    ((xpath('/table/row/occupate_1/text()', tessere))[1])::text AS occupate_1,
    ((xpath('/table/row/duplicati/text()', tessere))[1])::text AS duplicati,
    ((xpath('/table/row/assegnate/text()', autisti))[1])::text AS assegnate,
    ((xpath('/table/row/orfane/text()', autisti))[1])::text AS orfane
  FROM dati
),
dipendenze AS (
  SELECT DISTINCT pg_describe_object(d.classid,d.objid,d.objsubid) AS nome
  FROM tabelle t JOIN pg_depend d ON d.refclassid = 'pg_class'::regclass AND d.refobjid = t.oid
  WHERE d.deptype = 'n' AND (
    d.classid IN ('pg_rewrite'::regclass, 'pg_proc'::regclass)
    OR (d.classid = 'pg_constraint'::regclass AND EXISTS (
      SELECT 1 FROM pg_constraint c WHERE c.oid = d.objid
      AND NOT EXISTS (SELECT 1 FROM tabelle x WHERE x.oid = c.conrelid)
    ))
  )
),
routine_esterne AS (
  SELECT p.oid::regprocedure::text AS nome
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast','roma_rta_private')
    AND p.proname NOT LIKE 'roma\_rta\_%' AND p.proname <> 'genera_prossima_tessera'
    AND p.prosrc ~* '\m(pazienti|prenotazioni|autisti|genera_prossima_tessera)\M'
),
trigger_ddl AS (
  SELECT evtname, evtevent, evtenabled FROM pg_event_trigger WHERE evtenabled <> 'D'
),
esiti(area, controllo, esito, motivazione) AS (
  SELECT 'Prerequisiti', oggetto, CASE WHEN presente THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN presente THEN 'Presente.' ELSE 'Manca nel catalogo.' END FROM requisiti
  UNION ALL
  SELECT 'Schema', tabella, CASE WHEN bool_and(ok) THEN 'PASS' ELSE 'FAIL' END,
    coalesce(string_agg(nome || ' (' || coalesce(tipo, 'mancante') || ')', ', ' ORDER BY nome) FILTER (WHERE NOT ok), 'Colonne e tipi richiesti presenti.')
  FROM colonne_verificate GROUP BY tabella
  UNION ALL
  SELECT 'Migrazioni', oggetto, CASE WHEN presente THEN 'FAIL' ELSE 'PASS' END,
    CASE WHEN presente THEN 'Oggetti omonimi già presenti. Verificare collisione o installazione precedente.' ELSE 'Nessuna collisione rilevata.' END FROM collisioni
  UNION ALL
  SELECT 'Tessere', 'Numerazioni e duplicati',
    CASE WHEN tessere IS NULL THEN 'FAIL' WHEN duplicati::bigint > 0 OR senza_anno::bigint > 0 OR occupate_500::bigint > 0 OR occupate_1::bigint > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN tessere IS NULL THEN 'Dati non verificabili. Controllare schema, accesso amministrativo e RLS.'
      ELSE format('Tessere emesse: %s; minimo: %s; massimo: %s; coppie anno/numero duplicate: %s; senza anno: %s; 0500 occupato nel 2026: %s; 0001 occupato dal 2027: %s. I numeri occupati vengono saltati.',
        emesse, coalesce(minimo,'—'), coalesce(massimo,'—'), duplicati, senza_anno, occupate_500, occupate_1) END FROM conteggi
  UNION ALL
  SELECT 'Autisti', 'Assegnazioni storiche', CASE WHEN autisti IS NULL OR orfane::bigint > 0 THEN 'FAIL' ELSE 'PASS' END,
    CASE WHEN autisti IS NULL THEN 'Dati non verificabili. Controllare schema, accesso amministrativo e RLS.'
      ELSE format('Assegnazioni esistenti: %s; riferimenti senza autista: %s.', assegnate, orfane) END FROM conteggi
  UNION ALL
  SELECT 'Autisti', 'Relazione PostgREST legacy',
    CASE WHEN count(*) = 1 AND bool_and(convalidated AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (autista_id)%') THEN 'PASS' ELSE 'FAIL' END,
    format('Relazioni dirette prenotazioni/autisti: %s. È richiesta una sola FK valida su autista_id.', count(*))
  FROM pg_constraint WHERE contype = 'f' AND conrelid = to_regclass('public.prenotazioni') AND confrelid = to_regclass('public.autisti')
  UNION ALL
  SELECT 'Permessi', 'Accesso legacy autisti',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_roles r
      WHERE r.rolname = 'service_role' AND r.rolbypassrls
        AND has_table_privilege(r.oid, to_regclass('public.prenotazioni'), 'SELECT')
        AND (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = to_regclass('public.prenotazioni') AND NOT a.attisdropped
          AND a.attname IN ('ora_inizio_effettiva','ora_fine_effettiva') AND has_column_privilege(r.oid, a.attrelid, a.attnum, 'UPDATE')) = 2
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Il percorso precedente richiede SELECT, bypass RLS e UPDATE sulle due colonne orarie per service_role.'
  UNION ALL
  SELECT 'Permessi', t.nome,
    CASE WHEN c.relrowsecurity AND (SELECT count(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t.nome
        AND p.policyname IN ('roma_rta_lettura','roma_rta_inserimento','roma_rta_modifica','roma_rta_limite_operatore')
        AND p.roles = ARRAY['authenticated']::name[]
        AND (coalesce(p.qual,'') || coalesce(p.with_check,'')) LIKE '%operatore_abilitato%') = 4
      AND NOT has_any_column_privilege(to_regrole('anon'), t.oid, 'SELECT,INSERT,UPDATE')
    THEN 'PASS' ELSE 'FAIL' END,
    'Attese RLS, quattro policy ROMA R.T.A. e assenza di accesso anonimo alle colonne.'
  FROM tabelle t LEFT JOIN pg_class c ON c.oid = t.oid
  UNION ALL
  SELECT 'Permessi', 'Salvataggi legacy della centrale',
    CASE WHEN (SELECT count(*) FROM colonne_verificate c
      WHERE (c.tabella, c.nome) IN (('pazienti','numero_tessera'), ('prenotazioni','autista_id'))
        AND c.ok
        AND has_column_privilege(to_regrole('authenticated'), to_regclass('public.' || c.tabella), c.attnum, 'INSERT')
        AND has_column_privilege(to_regrole('authenticated'), to_regclass('public.' || c.tabella), c.attnum, 'UPDATE')) = 2
    THEN 'PASS' ELSE 'FAIL' END,
    'La centrale precedente richiede INSERT e UPDATE per numero tessera e autista principale.'
  UNION ALL
  SELECT 'Funzioni', f.nome,
    CASE WHEN p.oid IS NOT NULL AND p.prosecdef = f.definer
      AND has_function_privilege(to_regrole(f.ruolo), p.oid, 'EXECUTE')
      AND (NOT f.anon_vietato OR NOT has_function_privilege(to_regrole('anon'), p.oid, 'EXECUTE'))
      AND (f.ruolo <> 'service_role' OR NOT has_function_privilege(to_regrole('authenticated'), p.oid, 'EXECUTE'))
    THEN 'PASS' ELSE 'FAIL' END,
    format('Atteso %s con EXECUTE per %s%s. Rilevato: %s.',
      CASE WHEN f.definer THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END, f.ruolo,
      CASE WHEN f.anon_vietato THEN ', senza EXECUTE anonimo' ELSE '' END,
      CASE WHEN p.oid IS NULL THEN 'funzione mancante' ELSE format('definer=%s, EXECUTE ruolo=%s, EXECUTE anon=%s',
        p.prosecdef, has_function_privilege(to_regrole(f.ruolo),p.oid,'EXECUTE'), has_function_privilege(to_regrole('anon'),p.oid,'EXECUTE')) END)
  FROM funzioni f LEFT JOIN pg_proc p ON p.oid = to_regprocedure(f.nome)
  UNION ALL
  SELECT 'Isolamento', 'Dipendenze dichiarate',
    CASE WHEN count(*) > 0 THEN 'WARNING' ELSE 'PASS' END,
    coalesce(string_agg(nome, '; ' ORDER BY nome), 'Nessuna vista, routine o vincolo esterno rilevato nel catalogo.')
  FROM dipendenze
  UNION ALL
  SELECT 'Isolamento', 'Routine da verificare',
    CASE WHEN count(*) > 0 THEN 'WARNING' ELSE 'PASS' END,
    coalesce(string_agg(nome, '; ' ORDER BY nome), 'Nessun riferimento testuale esterno rilevato. Il controllo statico non rileva tutti gli usi via SQL dinamico o API.')
  FROM routine_esterne
  UNION ALL
  SELECT 'Isolamento', 'Trigger applicativi sulle tabelle coinvolte',
    CASE WHEN count(*) > 0 THEN 'WARNING' ELSE 'PASS' END,
    coalesce(string_agg(format('%s.%s', t.nome, g.tgname), '; ' ORDER BY t.nome, g.tgname),
      'Nessun trigger applicativo aggiuntivo rilevato.')
  FROM tabelle t JOIN pg_trigger g ON g.tgrelid = t.oid
  WHERE NOT g.tgisinternal AND g.tgenabled <> 'D'
    AND (t.nome, g.tgname) NOT IN (('autisti','roma_rta_revoca_sessioni'), ('pazienti','roma_rta_revoca_link_tessera'))
  UNION ALL
  SELECT 'Isolamento', 'Event trigger DDL',
    CASE WHEN count(*) > 0 THEN 'WARNING' ELSE 'PASS' END,
    coalesce('Attivi, verificare l''effetto sul DDL: ' || string_agg(format('%s (%s, %s)', evtname, evtevent, evtenabled), '; ' ORDER BY evtname),
      'Nessun event trigger attivo.')
  FROM trigger_ddl
)
SELECT area, controllo, esito, motivazione FROM esiti
ORDER BY CASE esito WHEN 'FAIL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, area, controllo;
