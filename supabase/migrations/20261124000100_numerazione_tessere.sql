BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE roma_rta_private.tessere_progressivi (
  anno integer PRIMARY KEY,
  prossimo bigint NOT NULL CHECK (prossimo > 0)
);
CREATE TABLE roma_rta_private.tessere_config (
  unico boolean PRIMARY KEY DEFAULT true CHECK (unico),
  accetta_legacy boolean NOT NULL DEFAULT true,
  iniziale_2026 integer NOT NULL DEFAULT 500 CHECK (iniziale_2026 BETWEEN 1 AND 99999),
  iniziale_annuale integer NOT NULL DEFAULT 1 CHECK (iniziale_annuale BETWEEN 1 AND 99999)
);
INSERT INTO roma_rta_private.tessere_config DEFAULT VALUES;
REVOKE ALL ON roma_rta_private.tessere_progressivi, roma_rta_private.tessere_config FROM PUBLIC, anon, authenticated, service_role;

-- Zero è la richiesta di emissione del gestionale. I numeri storici restano intatti.
CREATE FUNCTION roma_rta_private.numerazione_tessera() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a integer := extract(year FROM statement_timestamp() AT TIME ZONE 'Europe/Rome');
  n bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.numero_tessera IS NOT NULL AND OLD.numero_tessera <> 0 THEN
      IF NEW.numero_tessera IS DISTINCT FROM OLD.numero_tessera THEN
        RAISE EXCEPTION 'La tessera è già emessa';
      END IF;
      NEW.anno_tessera := OLD.anno_tessera;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.numero_tessera IS NULL THEN RETURN NEW; END IF;
  IF NEW.numero_tessera <> 0 THEN
    IF NEW.numero_tessera NOT BETWEEN 1 AND 99999 OR NOT (SELECT accetta_legacy FROM roma_rta_private.tessere_config) THEN
      RAISE EXCEPTION 'Usare la numerazione automatica';
    END IF;
    a := coalesce(NEW.anno_tessera, a);
  END IF;
  INSERT INTO roma_rta_private.tessere_progressivi (anno, prossimo)
    SELECT a, CASE WHEN a = 2026 THEN iniziale_2026 ELSE iniziale_annuale END
    FROM roma_rta_private.tessere_config
    ON CONFLICT (anno) DO NOTHING;
  SELECT prossimo INTO STRICT n FROM roma_rta_private.tessere_progressivi WHERE anno = a FOR UPDATE;
  -- Anche il salvataggio della versione precedente usa il lock annuale.
  IF NEW.numero_tessera <> 0 THEN
    IF EXISTS (SELECT 1 FROM public.pazienti WHERE numero_tessera = NEW.numero_tessera AND (anno_tessera = a OR anno_tessera IS NULL)) THEN
      RAISE EXCEPTION 'Numero tessera gia occupato';
    END IF;
    n := NEW.numero_tessera;
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.pazienti WHERE numero_tessera = n AND (anno_tessera = a OR anno_tessera IS NULL)) LOOP
    n := n + 1;
  END LOOP;
  IF n > 99999 THEN RAISE EXCEPTION 'Numerazione tessere esaurita'; END IF;
  UPDATE roma_rta_private.tessere_progressivi SET prossimo = n + 1 WHERE anno = a AND NEW.numero_tessera = 0;
  NEW.numero_tessera := n;
  NEW.anno_tessera := a;
  NEW.data_tesseramento := (statement_timestamp() AT TIME ZONE 'Europe/Rome')::date;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION roma_rta_private.numerazione_tessera() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER roma_rta_numerazione_tessera
BEFORE INSERT OR UPDATE OF numero_tessera, anno_tessera ON public.pazienti
FOR EACH ROW EXECUTE FUNCTION roma_rta_private.numerazione_tessera();
COMMIT;
