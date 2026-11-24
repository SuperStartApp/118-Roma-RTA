BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE roma_rta_private.ricevute_condivisioni (
  ricevuta_id uuid PRIMARY KEY REFERENCES public.roma_rta_ricevute(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  scade_il timestamptz NOT NULL
);
ALTER TABLE roma_rta_private.ricevute_condivisioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roma_rta_private.ricevute_condivisioni FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.roma_rta_condividi_ricevuta(p_ricevuta uuid, p_hash text) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE scadenza timestamptz;
BEGIN
  IF roma_rta_private.operatore_abilitato() IS NOT TRUE THEN
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Token non valido' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.roma_rta_ricevute WHERE id = p_ricevuta FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ricevuta non disponibile' USING ERRCODE = 'P0002'; END IF;
  scadenza := clock_timestamp() + interval '48 hours';
  INSERT INTO roma_rta_private.ricevute_condivisioni (ricevuta_id, token_hash, scade_il)
  VALUES (p_ricevuta, p_hash, scadenza)
  ON CONFLICT (ricevuta_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, scade_il = EXCLUDED.scade_il;
  RETURN scadenza;
END;
$$;

CREATE FUNCTION public.roma_rta_revoca_ricevuta(p_ricevuta uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF roma_rta_private.operatore_abilitato() IS NOT TRUE THEN
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.roma_rta_ricevute WHERE id = p_ricevuta FOR UPDATE;
  DELETE FROM roma_rta_private.ricevute_condivisioni WHERE ricevuta_id = p_ricevuta;
END;
$$;

CREATE FUNCTION public.roma_rta_leggi_ricevuta_condivisa(p_hash text) RETURNS SETOF public.roma_rta_ricevute
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.*
  FROM roma_rta_private.ricevute_condivisioni c
  JOIN public.roma_rta_ricevute r ON r.id = c.ricevuta_id
  WHERE c.token_hash = p_hash AND c.scade_il > statement_timestamp();
$$;

REVOKE ALL ON FUNCTION public.roma_rta_condividi_ricevuta(uuid, text), public.roma_rta_revoca_ricevuta(uuid),
  public.roma_rta_leggi_ricevuta_condivisa(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roma_rta_condividi_ricevuta(uuid, text), public.roma_rta_revoca_ricevuta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.roma_rta_leggi_ricevuta_condivisa(text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
