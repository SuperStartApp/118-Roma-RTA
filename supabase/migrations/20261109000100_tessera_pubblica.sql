-- ROMA R.T.A. - PROPOSTA LOCALE, NON ESEGUITA.
-- Applicazione amministrativa separata SOLO dopo AccessoCentrale e ricognizione.
-- Non applicare automaticamente tutte le migrazioni del repository.
-- Nessuna modifica Auth globale, a prenotazioni, autisti o tabelle di altri progetti.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.pazienti IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE tab text; rel regclass;
BEGIN
  IF to_regprocedure('roma_rta_private.operatore_abilitato()') IS NULL THEN
    RAISE EXCEPTION 'Applicare e verificare prima AccessoCentrale';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.pazienti'::regclass AND attname = 'id' AND atttypid = 'uuid'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Tipo ID paziente inatteso: riesaminare il DDL';
  END IF;
  -- Le funzioni nuove hanno current_user come proprietario: devono poter leggere
  -- le righe oltre le RLS senza aggiungere policy anonime. Non basta EXECUTE.
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Eseguire esclusivamente come amministratore fidato';
  END IF;
  FOREACH rel IN ARRAY ARRAY['public.pazienti'::regclass, 'roma_rta_private.operatori_centrale'::regclass] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN pg_catalog.pg_roles r
      WHERE c.oid = rel AND r.rolname = current_user
        AND (r.rolsuper OR r.rolbypassrls OR (c.relowner = r.oid AND NOT c.relforcerowsecurity))
    ) THEN
      RAISE EXCEPTION 'Proprietario nuove funzioni incompatibile con RLS su %', rel;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
    JOIN pg_catalog.pg_class c ON c.oid = 'roma_rta_private.operatori_centrale'::regclass
    WHERE p.oid = 'roma_rta_private.operatore_abilitato()'::regprocedure
      AND p.prokind = 'f' AND p.prosecdef AND p.prorettype = 'boolean'::regtype
      AND 'search_path=""' = ANY(p.proconfig)
      AND (r.rolsuper OR r.rolbypassrls OR (c.relowner = r.oid AND NOT c.relforcerowsecurity))
  ) THEN
    RAISE EXCEPTION 'Helper AccessoCentrale incompatibile: verificare proprietario, RLS e search_path';
  END IF;
  -- Non cambiamo i GRANT dello schema della fase 1: USAGE non concede lettura.
  IF has_schema_privilege('anon', 'roma_rta_private', 'USAGE,CREATE')
    OR has_schema_privilege('authenticated', 'roma_rta_private', 'CREATE')
    OR has_schema_privilege('service_role', 'roma_rta_private', 'CREATE')
    OR NOT has_schema_privilege('authenticated', 'roma_rta_private', 'USAGE')
    OR NOT has_schema_privilege('service_role', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'Privilegi schema inattesi: verificare prima di applicare';
  END IF;
  FOREACH tab IN ARRAY ARRAY['pazienti', 'prenotazioni', 'autisti'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = format('public.%I', tab)::regclass AND relrowsecurity)
      OR has_table_privilege('anon', format('public.%I', tab), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('anon', format('public.%I', tab), 'SELECT,INSERT,UPDATE,REFERENCES')
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = tab AND policyname = 'roma_rta_limite_operatore' AND permissive = 'RESTRICTIVE') THEN
      RAISE EXCEPTION 'Protezione AccessoCentrale non verificata su %', tab;
    END IF;
  END LOOP;
END $$;

CREATE TABLE roma_rta_private.tessere_condivisioni (
  paziente_id uuid PRIMARY KEY REFERENCES public.pazienti(id) ON DELETE CASCADE,
  numero text NOT NULL CHECK (numero ~ '^[1-9][0-9]*$'),
  anno integer NOT NULL CHECK (anno BETWEEN 1900 AND 9998),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  creato_il timestamptz NOT NULL DEFAULT clock_timestamp(),
  scade_il timestamptz NOT NULL,
  revocato_il timestamptz,
  creato_da uuid NOT NULL,
  CHECK (scade_il > creato_il),
  CHECK (scade_il = make_timestamptz(anno + 1, 1, 1, 0, 0, 0, 'Europe/Rome'))
);
ALTER TABLE roma_rta_private.tessere_condivisioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE roma_rta_private.tessere_condivisioni FROM PUBLIC, anon, authenticated, service_role;
-- Una sola condivisione corrente per paziente; rotazione sostituisce la precedente.
-- Nessuna policy client. Nessun cambiamento ai GRANT dello schema fase 1.

CREATE FUNCTION public.roma_rta_condividi_tessera(p_paziente uuid, p_hash text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE n text; a integer; scadenza timestamptz; istante timestamptz; operatore uuid;
BEGIN
  IF auth.uid() IS NULL OR roma_rta_private.operatore_abilitato() IS NOT TRUE THEN
    RAISE EXCEPTION 'Operatore non abilitato' USING ERRCODE = '42501';
  END IF;
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Hash non valido' USING ERRCODE = '22023';
  END IF;
  SELECT p.numero_tessera::text, p.anno_tessera INTO n, a
  FROM public.pazienti p WHERE p.id = p_paziente FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paziente non trovato' USING ERRCODE = 'P0002'; END IF;
  -- Ricontrollo dopo l'attesa del lock, con il JWT originale della richiesta.
  IF auth.uid() IS NULL OR roma_rta_private.operatore_abilitato() IS NOT TRUE THEN
    RAISE EXCEPTION 'Operatore non abilitato' USING ERRCODE = '42501';
  END IF;
  IF n IS NULL OR n !~ '^[1-9][0-9]*$' OR a IS NULL OR a NOT BETWEEN 1900 AND 9998 THEN
    RAISE EXCEPTION 'Tessera non emessa' USING ERRCODE = '22023';
  END IF;
  -- Tutto il 31 dicembre incluso; mezzanotte del primo gennaio esclusa.
  scadenza := make_timestamptz(a + 1, 1, 1, 0, 0, 0, 'Europe/Rome');
  istante := clock_timestamp(); -- dopo l'attesa, non all'inizio transazione
  operatore := auth.uid();
  IF scadenza <= istante THEN RAISE EXCEPTION 'Tessera scaduta' USING ERRCODE = '22023'; END IF;
  INSERT INTO roma_rta_private.tessere_condivisioni
    (paziente_id, numero, anno, token_hash, creato_il, scade_il, creato_da)
  VALUES (p_paziente, n, a, p_hash, istante, scadenza, operatore)
  ON CONFLICT (paziente_id) DO UPDATE
    SET numero = EXCLUDED.numero, anno = EXCLUDED.anno, token_hash = EXCLUDED.token_hash,
      creato_il = EXCLUDED.creato_il, scade_il = EXCLUDED.scade_il,
      revocato_il = NULL, creato_da = EXCLUDED.creato_da;
  RETURN scadenza;
END $$;
REVOKE ALL ON FUNCTION public.roma_rta_condividi_tessera(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roma_rta_condividi_tessera(uuid, text) TO authenticated;

CREATE FUNCTION public.roma_rta_revoca_tessera(p_paziente uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout = '5s' AS $$
BEGIN
  IF auth.uid() IS NULL OR roma_rta_private.operatore_abilitato() IS NOT TRUE THEN
    RAISE EXCEPTION 'Operatore non abilitato' USING ERRCODE = '42501';
  END IF;
  -- Stesso ordine dei lock: paziente, poi condivisione.
  PERFORM 1 FROM public.pazienti p WHERE p.id = p_paziente FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paziente non trovato' USING ERRCODE = 'P0002'; END IF;
  IF auth.uid() IS NULL OR roma_rta_private.operatore_abilitato() IS NOT TRUE THEN
    RAISE EXCEPTION 'Operatore non abilitato' USING ERRCODE = '42501';
  END IF;
  UPDATE roma_rta_private.tessere_condivisioni SET revocato_il = clock_timestamp()
  WHERE paziente_id = p_paziente AND revocato_il IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.roma_rta_revoca_tessera(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roma_rta_revoca_tessera(uuid) TO authenticated;

CREATE FUNCTION public.roma_rta_leggi_tessera(p_hash text)
RETURNS TABLE(nome text, cognome text, numero text, anno integer, emissione date, scadenza date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.nome::text, p.cognome::text, c.numero, c.anno,
    p.data_tesseramento::date, make_date(c.anno, 12, 31)
  FROM roma_rta_private.tessere_condivisioni c JOIN public.pazienti p ON p.id = c.paziente_id
  WHERE c.token_hash = p_hash AND c.revocato_il IS NULL AND c.scade_il > statement_timestamp()
    AND p.numero_tessera::text = c.numero AND p.anno_tessera = c.anno
    AND statement_timestamp() < make_timestamptz(c.anno + 1, 1, 1, 0, 0, 0, 'Europe/Rome');
$$;
REVOKE ALL ON FUNCTION public.roma_rta_leggi_tessera(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roma_rta_leggi_tessera(text) TO service_role;

CREATE FUNCTION roma_rta_private.revoca_tessera_modificata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout = '5s' AS $$
BEGIN
  IF OLD.numero_tessera IS DISTINCT FROM NEW.numero_tessera OR OLD.anno_tessera IS DISTINCT FROM NEW.anno_tessera THEN
    UPDATE roma_rta_private.tessere_condivisioni SET revocato_il = clock_timestamp()
    WHERE paziente_id = NEW.id AND revocato_il IS NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION roma_rta_private.revoca_tessera_modificata() FROM PUBLIC, anon, authenticated, service_role;
-- WHEN evita invocazioni per normali modifiche e valori invariati.
-- AFTER UPDATE intercetta anche cambiamenti prodotti da altri BEFORE trigger.
CREATE TRIGGER roma_rta_revoca_link_tessera AFTER UPDATE ON public.pazienti
FOR EACH ROW WHEN (OLD.numero_tessera IS DISTINCT FROM NEW.numero_tessera OR OLD.anno_tessera IS DISTINCT FROM NEW.anno_tessera)
EXECUTE FUNCTION roma_rta_private.revoca_tessera_modificata();

DO $$
BEGIN
  IF has_table_privilege('anon', 'roma_rta_private.tessere_condivisioni', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated', 'roma_rta_private.tessere_condivisioni', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege('anon', 'roma_rta_private.tessere_condivisioni', 'SELECT,INSERT,UPDATE,REFERENCES')
    OR has_any_column_privilege('authenticated', 'roma_rta_private.tessere_condivisioni', 'SELECT,INSERT,UPDATE,REFERENCES')
    OR has_table_privilege('service_role', 'roma_rta_private.tessere_condivisioni', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege('service_role', 'roma_rta_private.tessere_condivisioni', 'SELECT,INSERT,UPDATE,REFERENCES')
    OR has_function_privilege('anon', 'public.roma_rta_leggi_tessera(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.roma_rta_leggi_tessera(text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.roma_rta_condividi_tessera(uuid,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.roma_rta_revoca_tessera(uuid)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.roma_rta_condividi_tessera(uuid,text)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.roma_rta_revoca_tessera(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.roma_rta_condividi_tessera(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.roma_rta_revoca_tessera(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.roma_rta_leggi_tessera(text)', 'EXECUTE')
    OR has_function_privilege('anon', 'roma_rta_private.revoca_tessera_modificata()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'roma_rta_private.revoca_tessera_modificata()', 'EXECUTE')
    OR has_function_privilege('service_role', 'roma_rta_private.revoca_tessera_modificata()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Privilegi ereditati inattesi: nessuna modifica applicata';
  END IF;
END $$;
COMMIT;
