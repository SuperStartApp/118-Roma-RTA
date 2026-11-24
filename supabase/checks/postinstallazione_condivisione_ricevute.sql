-- Unico SELECT di sola lettura. Eseguire dopo 20261124000400_condivisione_ricevute.sql.
WITH oggetti AS (
  SELECT to_regclass('roma_rta_private.ricevute_condivisioni') AS link,
    to_regclass('public.roma_rta_ricevute') AS archivio,
    to_regprocedure('roma_rta_private.operatore_abilitato()') AS operatore
),
colonne AS (
  SELECT a.attname, a.attnum, a.atttypid, a.attnotnull
  FROM oggetti o JOIN pg_attribute a ON a.attrelid = o.link
  WHERE a.attnum > 0 AND NOT a.attisdropped
),
routine(nome, firma, ruolo) AS (VALUES
  ('Creazione e reinvio', 'public.roma_rta_condividi_ricevuta(uuid,text)', 'authenticated'),
  ('Revoca', 'public.roma_rta_revoca_ricevuta(uuid)', 'authenticated'),
  ('Lettura PDF', 'public.roma_rta_leggi_ricevuta_condivisa(text)', 'service_role')
),
funzioni AS (
  SELECT r.*, p.oid, p.prosrc, p.prosecdef, p.proconfig, p.proretset, p.prorettype
  FROM routine r LEFT JOIN pg_proc p ON p.oid = to_regprocedure(r.firma)
),
esiti(controllo, ok, motivazione) AS (
  SELECT 'Prerequisiti e tabella condivisioni',
    link IS NOT NULL AND archivio IS NOT NULL AND operatore IS NOT NULL,
    'Attesi archivio ricevute, controllo operatore e tabella privata dei link.'
  FROM oggetti
  UNION ALL
  SELECT 'Hash e scadenza',
    (SELECT count(*) = 3 AND count(*) FILTER (WHERE attnotnull AND (
      (attname = 'token_hash' AND atttypid = 'text'::regtype) OR
      (attname = 'ricevuta_id' AND atttypid = 'uuid'::regtype) OR
      (attname = 'scade_il' AND atttypid = 'timestamptz'::regtype)
    )) = 3 FROM colonne)
    AND EXISTS (SELECT 1 FROM pg_constraint c JOIN colonne a ON c.conkey = ARRAY[a.attnum]
      WHERE c.conrelid = o.link AND c.contype = 'u' AND a.attname = 'token_hash')
    AND EXISTS (SELECT 1 FROM pg_constraint c JOIN colonne a ON a.attnum = ANY(c.conkey)
      WHERE c.conrelid = o.link AND c.contype = 'c' AND c.convalidated AND a.attname = 'token_hash'
        AND pg_get_constraintdef(c.oid) LIKE '%^[0-9a-f]{64}$%'),
    'Attesi solo identificativo della ricevuta, hash esadecimale univoco e scadenza obbligatoria.'
  FROM oggetti o
  UNION ALL
  SELECT 'Un solo link per ricevuta',
    EXISTS (SELECT 1 FROM pg_constraint c JOIN colonne a ON c.conkey = ARRAY[a.attnum]
      WHERE c.conrelid = o.link AND c.contype = 'p' AND a.attname = 'ricevuta_id')
    AND EXISTS (SELECT 1 FROM pg_constraint c JOIN colonne a ON c.conkey = ARRAY[a.attnum]
      WHERE c.conrelid = o.link AND c.contype = 'f' AND c.confrelid = o.archivio AND c.convalidated
        AND a.attname = 'ricevuta_id' AND c.confdeltype = 'c'),
    'Attesa chiave primaria per ricevuta e FK valida verso l’archivio.'
  FROM oggetti o
  UNION ALL
  SELECT 'Accesso alla tabella privata',
    EXISTS (SELECT 1 FROM pg_class WHERE oid = o.link AND relrowsecurity)
    AND (SELECT count(*) = 3 FROM pg_roles r
      WHERE r.rolname IN ('anon','authenticated','service_role')
        AND NOT has_any_column_privilege(r.oid, o.link, 'SELECT,INSERT,UPDATE,REFERENCES')
        AND NOT has_table_privilege(r.oid, o.link, 'DELETE,TRUNCATE,TRIGGER')),
    'Attese RLS attiva e nessun accesso diretto per i ruoli applicativi.'
  FROM oggetti o
  UNION ALL
  SELECT 'Permessi RPC · ' || f.nome,
    f.prosecdef AND 'search_path=""' = ANY(f.proconfig)
    AND (SELECT count(*) = 3 FROM pg_roles r
      WHERE r.rolname IN ('anon','authenticated','service_role')
        AND has_function_privilege(r.oid, f.oid, 'EXECUTE') = (r.rolname = f.ruolo)),
    format('Atteso SECURITY DEFINER con search_path vuoto ed EXECUTE solo per %s fra i ruoli applicativi.', f.ruolo)
  FROM funzioni f
  UNION ALL
  SELECT 'Controllo server di durata, revoca e reinvio',
    (SELECT count(*) = 3 FROM funzioni f CROSS JOIN oggetti o
      WHERE (f.nome = 'Creazione e reinvio' AND f.prosrc ILIKE '%operatore_abilitato()%'
             AND f.prosrc ILIKE '%interval ''48 hours''%' AND f.prosrc ILIKE '%ON CONFLICT (ricevuta_id) DO UPDATE%')
         OR (f.nome = 'Revoca' AND f.prosrc ILIKE '%operatore_abilitato()%'
             AND f.prosrc ILIKE '%DELETE FROM roma_rta_private.ricevute_condivisioni%WHERE ricevuta_id = p_ricevuta%')
         OR (f.nome = 'Lettura PDF' AND f.proretset AND f.prorettype = (SELECT reltype FROM pg_class WHERE oid = o.archivio)
             AND f.prosrc ILIKE '%c.token_hash = p_hash AND c.scade_il > statement_timestamp()%')),
    'Attesi rinnovo del link, revoca sul database e controllo della scadenza alla lettura. La prova operativa resta indipendente.'
)
SELECT controllo, CASE WHEN ok IS TRUE THEN 'PASS' ELSE 'FAIL' END AS esito, motivazione
FROM esiti
ORDER BY ok IS TRUE, controllo;
