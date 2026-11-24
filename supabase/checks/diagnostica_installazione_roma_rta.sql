-- Eseguire lo stesso SELECT nei due SQL Editor. Annotare il riferimento del progetto dalla dashboard.
-- Solo cataloghi e conteggi. Nessun PIN, hash o dato anagrafico viene restituito.
WITH attesi(gruppo, tipo, nome) AS (VALUES
  ('Base ROMA R.T.A.', 'schema', 'roma_rta_private'),
  ('Base ROMA R.T.A.', 'relation', 'public.pazienti'),
  ('Base ROMA R.T.A.', 'relation', 'public.prenotazioni'),
  ('Base ROMA R.T.A.', 'relation', 'public.autisti'),
  ('Base ROMA R.T.A.', 'relation', 'roma_rta_private.operatori_centrale'),
  ('Base ROMA R.T.A.', 'function', 'roma_rta_private.operatore_abilitato()'),
  ('Base ROMA R.T.A.', 'function', 'public.roma_rta_operatore_abilitato()'),
  ('Base ROMA R.T.A.', 'relation', 'roma_rta_private.tessere_condivisioni'),
  ('Base ROMA R.T.A.', 'function', 'public.roma_rta_condividi_tessera(uuid,text)'),
  ('Base ROMA R.T.A.', 'function', 'public.roma_rta_revoca_tessera(uuid)'),
  ('Base ROMA R.T.A.', 'function', 'public.roma_rta_leggi_tessera(text)'),
  ('20261123000100 · Sessioni autisti', 'relation', 'roma_rta_private.autista_credenziali'),
  ('20261123000100 · Sessioni autisti', 'relation', 'roma_rta_private.autista_sessioni'),
  ('20261123000100 · Sessioni autisti', 'relation', 'roma_rta_private.autista_tentativi'),
  ('20261123000100 · Sessioni autisti', 'relation', 'roma_rta_private.roma_rta_autista_sessioni_id_idx'),
  ('20261123000100 · Sessioni autisti', 'function', 'public.roma_rta_autista_registra(text,text,text,text)'),
  ('20261123000100 · Sessioni autisti', 'function', 'public.roma_rta_autista_rigenera_pin(uuid)'),
  ('20261123000100 · Sessioni autisti', 'function', 'public.roma_rta_autista_login(text,text,text)'),
  ('20261123000100 · Sessioni autisti', 'function', 'public.roma_rta_autista_sessione(text)'),
  ('20261123000100 · Sessioni autisti', 'function', 'public.roma_rta_autista_logout(text)'),
  ('20261123000100 · Sessioni autisti', 'function', 'roma_rta_private.revoca_sessioni_autista()'),
  ('20261123000100 · Sessioni autisti', 'constraint', 'public.autisti.roma_rta_pin_legacy_vuoto'),
  ('20261123000100 · Sessioni autisti', 'trigger', 'public.autisti.roma_rta_revoca_sessioni'),
  ('20261124000100 · Tessere', 'relation', 'roma_rta_private.tessere_config'),
  ('20261124000100 · Tessere', 'relation', 'roma_rta_private.tessere_progressivi'),
  ('20261124000100 · Tessere', 'function', 'roma_rta_private.numerazione_tessera()'),
  ('20261124000100 · Tessere', 'trigger', 'public.pazienti.roma_rta_numerazione_tessera'),
  ('20261124000200 · Autisti multipli', 'relation', 'public.roma_rta_prenotazioni_autisti'),
  ('20261124000200 · Autisti multipli', 'policy', 'public.roma_rta_prenotazioni_autisti.roma_rta_leggi_assegnazioni'),
  ('20261124000200 · Autisti multipli', 'column', 'public.prenotazioni.inizio_registrato_da'),
  ('20261124000200 · Autisti multipli', 'column', 'public.prenotazioni.fine_registrata_da'),
  ('20261124000200 · Autisti multipli', 'function', 'roma_rta_private.sincronizza_autista_principale()'),
  ('20261124000200 · Autisti multipli', 'trigger', 'public.prenotazioni.roma_rta_autista_principale'),
  ('20261124000200 · Autisti multipli', 'function', 'public.roma_rta_assegna_autisti(uuid,uuid[])'),
  ('20261124000200 · Autisti multipli', 'function', 'public.roma_rta_crea_prenotazione(uuid,jsonb,uuid[])'),
  ('20261124000200 · Autisti multipli', 'function', 'public.roma_rta_registra_ora(uuid,uuid,text)'),
  ('20261124000300 · Ricevute', 'relation', 'roma_rta_private.ricevute_config'),
  ('20261124000300 · Ricevute', 'relation', 'roma_rta_private.ricevute_progressivi'),
  ('20261124000300 · Ricevute', 'relation', 'public.roma_rta_ricevute'),
  ('20261124000300 · Ricevute', 'policy', 'public.roma_rta_ricevute.roma_rta_archivio_ricevute'),
  ('20261124000300 · Ricevute', 'function', 'public.roma_rta_config_ricevute()'),
  ('20261124000300 · Ricevute', 'function', 'public.roma_rta_emetti_ricevuta(uuid,text,text,text,text,numeric,text,date,text,jsonb,jsonb)')
),
inventario AS (
  SELECT a.*,
    CASE tipo
      WHEN 'schema' THEN to_regnamespace(nome) IS NOT NULL
      WHEN 'relation' THEN to_regclass(nome) IS NOT NULL
      WHEN 'function' THEN to_regprocedure(nome) IS NOT NULL
      WHEN 'constraint' THEN EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid = r.oid AND conname = r.oggetto)
      WHEN 'trigger' THEN EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgrelid = r.oid AND tgname = r.oggetto AND NOT tgisinternal)
      WHEN 'policy' THEN EXISTS (SELECT 1 FROM pg_policy
        WHERE polrelid = r.oid AND polname = r.oggetto)
      WHEN 'column' THEN EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid = r.oid AND attname = r.oggetto AND attnum > 0 AND NOT attisdropped)
    END AS presente
  FROM attesi a
  CROSS JOIN LATERAL (SELECT
    CASE WHEN tipo IN ('column','constraint','policy','trigger')
      THEN to_regclass(split_part(nome,'.',1) || '.' || split_part(nome,'.',2)) END AS oid,
    split_part(nome,'.',3) AS oggetto
  ) r
),
stato AS (
  SELECT gruppo, count(*) FILTER (WHERE presente) AS presenti, count(*) AS attesi,
    string_agg(nome, ', ' ORDER BY nome) FILTER (WHERE presente) AS trovati,
    string_agg(nome, ', ' ORDER BY nome) FILTER (WHERE NOT presente) AS mancanti
  FROM inventario GROUP BY gruppo
),
contesto AS (
  SELECT to_regclass('public.autisti') AS autisti,
    to_regclass('roma_rta_private.autista_credenziali') AS credenziali,
    to_regclass('public.prenotazioni') AS prenotazioni
),
effetti AS MATERIALIZED (
  SELECT
    CASE WHEN has_table_privilege(autisti, 'SELECT') AND NOT row_security_active(autisti)
       AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = autisti AND attname = 'pin' AND NOT attisdropped)
    THEN query_to_xml($sql$
      SELECT format('Righe: %s. PIN vuoti: %s. PIN non vuoti o nulli: %s.',
        count(*), count(*) FILTER (WHERE pin::text = ''), count(*) FILTER (WHERE pin::text IS DISTINCT FROM '')) AS dettaglio
      FROM public.autisti
    $sql$, false, false, '') END AS pin,
    CASE WHEN has_table_privilege(credenziali, 'SELECT') AND NOT row_security_active(credenziali)
      AND has_table_privilege(autisti, 'SELECT') AND NOT row_security_active(autisti)
      AND (SELECT count(*) FROM pg_attribute WHERE NOT attisdropped AND atttypid = 'uuid'::regtype
        AND ((attrelid = credenziali AND attname = 'autista_id') OR (attrelid = autisti AND attname = 'id'))) = 2
    THEN query_to_xml($sql$
      SELECT format('Credenziali: %s. Autisti senza credenziale: %s. Credenziali senza autista: %s.',
        (SELECT count(*) FROM roma_rta_private.autista_credenziali),
        count(*) FILTER (WHERE c.autista_id IS NULL), count(*) FILTER (WHERE a.id IS NULL)) AS dettaglio
      FROM public.autisti a FULL JOIN roma_rta_private.autista_credenziali c ON c.autista_id = a.id
    $sql$, false, false, '') END AS copertura
  FROM contesto
),
esiti(area, controllo, esito, motivazione) AS (
  SELECT 'Inventario', gruppo,
    CASE WHEN presenti = 0 THEN 'ASSENTE' WHEN presenti = attesi THEN 'PRESENTE' ELSE 'PARZIALE' END,
    format('%s/%s oggetti. Presenti: %s. Mancanti: %s.', presenti, attesi, coalesce(trovati,'—'), coalesce(mancanti,'—'))
  FROM stato
  UNION ALL
  SELECT 'Contesto', 'Database e ruolo', 'INFO',
    format('Database: %s. Ruolo: %s. Per distinguere i due progetti, usare il riferimento nella dashboard.', current_database(), current_user)
  UNION ALL
  SELECT 'Impatto', 'public.autisti: PIN e vincolo',
    CASE WHEN pin IS NULL THEN 'NON VERIFICABILE' ELSE 'RILEVATO' END,
    concat_ws(' ', coalesce(((xpath('/table/row/dettaglio/text()', pin))[1])::text,
      'Tabella/colonna assente o conteggio non disponibile con il ruolo corrente.'),
      (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
        WHERE c.conrelid = to_regclass('public.autisti') AND c.conname = 'roma_rta_pin_legacy_vuoto'))
  FROM effetti
  UNION ALL
  SELECT 'Impatto', 'Copertura credenziali autisti',
    CASE WHEN copertura IS NULL THEN 'NON VERIFICABILE' ELSE 'RILEVATO' END,
    coalesce(((xpath('/table/row/dettaglio/text()', copertura))[1])::text,
      'Tabelle o colonne assenti/incompatibili, oppure accesso incompleto.')
  FROM effetti
  UNION ALL
  SELECT 'Impatto', 'Effetti sulle prenotazioni', 'INFO',
    format('Colonne di audit rilevate: %s. Privilegi a livello tabella di authenticated: INSERT=%s, UPDATE=%s. La migrazione multipla passa a grant per colonna.',
      (SELECT count(*) FROM pg_attribute WHERE attrelid = prenotazioni AND NOT attisdropped
        AND attname IN ('inizio_registrato_da','fine_registrata_da')),
      coalesce(has_table_privilege(to_regrole('authenticated'), prenotazioni, 'INSERT')::text, 'n/d'),
      coalesce(has_table_privilege(to_regrole('authenticated'), prenotazioni, 'UPDATE')::text, 'n/d'))
  FROM contesto
  UNION ALL
  SELECT 'Dipendenze', 'FK da risorse esterne alla base',
    CASE WHEN count(*) > 0 THEN 'DA VERIFICARE' ELSE 'NESSUNA RILEVATA' END,
    coalesce(string_agg(format('%s: %s → %s', c.conrelid::regclass, c.conname, c.confrelid::regclass),
      '; ' ORDER BY c.conrelid::regclass::text, c.conname), 'Nessuna FK esterna rilevata verso le tre tabelle di base.')
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.confrelid IN (to_regclass('public.autisti'), to_regclass('public.pazienti'), to_regclass('public.prenotazioni'))
    AND c.conrelid IS DISTINCT FROM to_regclass('public.autisti')
    AND c.conrelid IS DISTINCT FROM to_regclass('public.pazienti')
    AND c.conrelid IS DISTINCT FROM to_regclass('public.prenotazioni')
  UNION ALL
  SELECT 'Dipendenze', 'Viste e routine collegate', CASE WHEN count(*) > 0 THEN 'DA VERIFICARE' ELSE 'NESSUNA RILEVATA' END,
    coalesce(string_agg(nome, '; ' ORDER BY nome), 'Nessuna vista o routine collegata rilevata nel catalogo.')
  FROM (
    SELECT DISTINCT pg_describe_object(d.classid,d.objid,d.objsubid) AS nome
    FROM pg_depend d
    WHERE d.refclassid = 'pg_class'::regclass AND d.deptype = 'n'
      AND d.classid IN ('pg_proc'::regclass, 'pg_rewrite'::regclass)
      AND d.refobjid IN (to_regclass('public.autisti'), to_regclass('public.pazienti'), to_regclass('public.prenotazioni'))
  ) v
  UNION ALL
  SELECT 'Dipendenze', 'Event trigger DDL attivi',
    CASE WHEN count(*) > 0 THEN 'DA VERIFICARE' ELSE 'NESSUNO RILEVATO' END,
    coalesce(string_agg(format('%s (%s)', evtname, evtevent), '; ' ORDER BY evtname), 'Nessun event trigger attivo.')
  FROM pg_event_trigger WHERE evtenabled <> 'D'
  UNION ALL
  SELECT 'Limiti', 'Attribuzione storica', 'INFO',
    'Lo stato attuale non prova chi, quando o con quale script abbia modificato dati, grant o oggetti. Confrontare i due risultati e consultare i log o un backup se occorre attribuire un cambiamento.'
)
SELECT area, controllo, esito, motivazione FROM esiti
ORDER BY CASE WHEN area = 'Contesto' THEN 0 WHEN area = 'Inventario' THEN 1 ELSE 2 END, area, controllo;
