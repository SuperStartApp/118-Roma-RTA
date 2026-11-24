BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.prenotazioni IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.roma_rta_prenotazioni_autisti (
  -- La chiave separata evita che PostgREST esponga una seconda relazione implicita prenotazioni/autisti.
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prenotazione_id uuid NOT NULL REFERENCES public.prenotazioni(id) ON DELETE CASCADE,
  autista_id uuid NOT NULL REFERENCES public.autisti(id),
  UNIQUE (prenotazione_id, autista_id)
);
CREATE INDEX ON public.roma_rta_prenotazioni_autisti (autista_id, prenotazione_id);
INSERT INTO public.roma_rta_prenotazioni_autisti (prenotazione_id, autista_id)
SELECT id, autista_id FROM public.prenotazioni WHERE autista_id IS NOT NULL;
ALTER TABLE public.roma_rta_prenotazioni_autisti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roma_rta_prenotazioni_autisti FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.roma_rta_prenotazioni_autisti TO authenticated, service_role;
CREATE POLICY roma_rta_leggi_assegnazioni ON public.roma_rta_prenotazioni_autisti
FOR SELECT TO authenticated USING ((SELECT roma_rta_private.operatore_abilitato()));

ALTER TABLE public.prenotazioni
  ADD COLUMN inizio_registrato_da uuid,
  ADD COLUMN fine_registrata_da uuid;
REVOKE INSERT, UPDATE ON public.prenotazioni FROM authenticated;
REVOKE INSERT (ora_inizio_effettiva, ora_fine_effettiva, inizio_registrato_da, fine_registrata_da),
  UPDATE (ora_inizio_effettiva, ora_fine_effettiva, inizio_registrato_da, fine_registrata_da)
ON public.prenotazioni FROM authenticated;
DO $$
DECLARE colonne text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ') INTO colonne
  FROM pg_attribute WHERE attrelid = 'public.prenotazioni'::regclass AND attnum > 0 AND NOT attisdropped
  AND attname NOT IN ('ora_inizio_effettiva', 'ora_fine_effettiva', 'inizio_registrato_da', 'fine_registrata_da');
  EXECUTE 'GRANT INSERT (' || colonne || '), UPDATE (' || colonne || ') ON public.prenotazioni TO authenticated';
END;
$$;

CREATE FUNCTION roma_rta_private.sincronizza_autista_principale() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.autista_id IS DISTINCT FROM NEW.autista_id THEN
    DELETE FROM public.roma_rta_prenotazioni_autisti
    WHERE prenotazione_id = NEW.id AND autista_id = OLD.autista_id;
  END IF;
  IF NEW.autista_id IS NOT NULL THEN
    INSERT INTO public.roma_rta_prenotazioni_autisti (prenotazione_id, autista_id) VALUES (NEW.id, NEW.autista_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER roma_rta_autista_principale AFTER INSERT OR UPDATE OF autista_id ON public.prenotazioni
FOR EACH ROW EXECUTE FUNCTION roma_rta_private.sincronizza_autista_principale();

CREATE FUNCTION public.roma_rta_assegna_autisti(p_id uuid, p_autisti uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF roma_rta_private.operatore_abilitato() IS NOT TRUE THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_autisti) AS x(id) WHERE x.id IS NULL)
    OR cardinality(p_autisti) <> (SELECT count(DISTINCT x.id) FROM unnest(p_autisti) AS x(id))
  THEN RAISE EXCEPTION 'Elenco autisti non valido'; END IF;
  PERFORM 1 FROM public.prenotazioni WHERE id = p_id AND annullata_il IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corsa non modificabile'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_autisti) AS x(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.autisti WHERE id = x.id AND attivo IS TRUE)
      AND NOT EXISTS (SELECT 1 FROM public.roma_rta_prenotazioni_autisti WHERE prenotazione_id = p_id AND autista_id = x.id)
  ) THEN RAISE EXCEPTION 'Autista non disponibile'; END IF;
  UPDATE public.prenotazioni SET autista_id = p_autisti[1] WHERE id = p_id;
  DELETE FROM public.roma_rta_prenotazioni_autisti
    WHERE prenotazione_id = p_id AND NOT (autista_id = ANY(coalesce(p_autisti, ARRAY[]::uuid[])));
  INSERT INTO public.roma_rta_prenotazioni_autisti (prenotazione_id, autista_id)
    SELECT p_id, x.id FROM unnest(p_autisti) AS x(id) ON CONFLICT DO NOTHING;
END;
$$;

CREATE FUNCTION public.roma_rta_crea_prenotazione(p_id uuid, p_dati jsonb, p_autisti uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.prenotazioni;
  nuovo_id uuid;
BEGIN
  IF roma_rta_private.operatore_abilitato() IS NOT TRUE THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501'; END IF;
  r := jsonb_populate_record(NULL::public.prenotazioni, p_dati);
  INSERT INTO public.prenotazioni (
    id,
    paziente_id,
    data_appuntamento,
    ora_appuntamento,
    serve_ossigeno,
    serve_medico,
    note,
    partenza_citta,
    partenza_via,
    partenza_civico,
    partenza_piano,
    partenza_interno,
    partenza_ascensore,
    partenza_dettagli_ospedale,
    arrivo_citta,
    arrivo_via,
    arrivo_civico,
    arrivo_piano,
    arrivo_interno,
    arrivo_ascensore,
    arrivo_dettagli_ospedale,
    costo,
    ore_incluse,
    costo_ora_supplementare,
    metodo_pagamento,
    pagato
  ) VALUES (
    p_id,
    r.paziente_id,
    r.data_appuntamento,
    r.ora_appuntamento,
    r.serve_ossigeno,
    r.serve_medico,
    r.note,
    r.partenza_citta,
    r.partenza_via,
    r.partenza_civico,
    r.partenza_piano,
    r.partenza_interno,
    r.partenza_ascensore,
    r.partenza_dettagli_ospedale,
    r.arrivo_citta,
    r.arrivo_via,
    r.arrivo_civico,
    r.arrivo_piano,
    r.arrivo_interno,
    r.arrivo_ascensore,
    r.arrivo_dettagli_ospedale,
    r.costo,
    r.ore_incluse,
    r.costo_ora_supplementare,
    r.metodo_pagamento,
    r.pagato
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO nuovo_id;
  IF NOT FOUND THEN RETURN p_id; END IF;
  PERFORM public.roma_rta_assegna_autisti(nuovo_id, p_autisti);
  RETURN nuovo_id;
END;
$$;

CREATE FUNCTION public.roma_rta_registra_ora(p_id uuid, p_autista uuid, p_tipo text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.prenotazioni WHERE id = p_id AND annullata_il IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.roma_rta_prenotazioni_autisti aa JOIN public.autisti a ON a.id = aa.autista_id
    WHERE aa.prenotazione_id = p_id AND aa.autista_id = p_autista AND a.attivo IS TRUE
  ) THEN RETURN false; END IF;
  IF p_tipo = 'inizio' THEN
    UPDATE public.prenotazioni SET ora_inizio_effettiva = clock_timestamp(), inizio_registrato_da = p_autista
    WHERE id = p_id AND ora_inizio_effettiva IS NULL;
  ELSIF p_tipo = 'fine' THEN
    UPDATE public.prenotazioni SET ora_fine_effettiva = clock_timestamp(), fine_registrata_da = p_autista
    WHERE id = p_id AND ora_inizio_effettiva IS NOT NULL AND ora_fine_effettiva IS NULL;
  ELSE
    RETURN false;
  END IF;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION roma_rta_private.sincronizza_autista_principale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roma_rta_assegna_autisti(uuid, uuid[]), public.roma_rta_crea_prenotazione(uuid, jsonb, uuid[]), public.roma_rta_registra_ora(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roma_rta_assegna_autisti(uuid, uuid[]), public.roma_rta_crea_prenotazione(uuid, jsonb, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.roma_rta_registra_ora(uuid, uuid, text) TO service_role;
COMMIT;
