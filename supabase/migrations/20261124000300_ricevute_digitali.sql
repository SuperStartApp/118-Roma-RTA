BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE roma_rta_private.ricevute_config (
  unico boolean PRIMARY KEY DEFAULT true CHECK (unico),
  emissione_attiva boolean NOT NULL DEFAULT false,
  serie text NOT NULL DEFAULT '' CHECK (serie ~ '^[A-Z0-9-]{0,12}$'),
  iniziale_2026 integer NOT NULL DEFAULT 500 CHECK (iniziale_2026 BETWEEN 1 AND 99999),
  iniziale_annuale integer NOT NULL DEFAULT 1 CHECK (iniziale_annuale BETWEEN 1 AND 99999),
  emittente jsonb NOT NULL DEFAULT '{"denominazione":"ROMA R.T.A.","denominazioneCompleta":"ORGANIZZAZIONE EUROPEA VOLONTARI DI PREVENZIONE E PROTEZIONE CIVILE","distaccamento":"DIST.TO DI ROMA: TUTELA ANIMALE E AMBIENTALE","indirizzo":"Via di Torrenova, 43 - 00133 Roma","telefono":"06 45776290","cellulare":"375 6149861","email":"118rta@gmail.com","codiceFiscale":"97643280585","partitaIva":"11882471003","iscrizioni":["Iscr. Regione Lazio Sez. Amb. n° B9566","Prot. Civ. n° B01420","Sanitaria n° G00533"]}'::jsonb CHECK (
      jsonb_typeof(emittente) = 'object' AND jsonb_typeof(emittente->'iscrizioni') = 'array'
      AND emittente ?& ARRAY['denominazione','denominazioneCompleta','distaccamento','indirizzo','telefono','cellulare','email','codiceFiscale','partitaIva','iscrizioni']
    )
);
INSERT INTO roma_rta_private.ricevute_config DEFAULT VALUES;
CREATE TABLE roma_rta_private.ricevute_progressivi (
  serie text NOT NULL,
  anno integer NOT NULL,
  prossimo integer NOT NULL CHECK (prossimo > 0),
  PRIMARY KEY (serie, anno)
);
CREATE TABLE public.roma_rta_ricevute (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prenotazione_id uuid NOT NULL UNIQUE REFERENCES public.prenotazioni(id),
  serie text NOT NULL,
  anno integer NOT NULL,
  numero integer NOT NULL CHECK (numero BETWEEN 1 AND 99999),
  emessa_il timestamptz NOT NULL,
  emessa_da uuid NOT NULL,
  importo numeric(12,2) NOT NULL CHECK (importo > 0),
  metodo_pagamento text,
  data_servizio date NOT NULL,
  intestatario text NOT NULL,
  codice_fiscale text,
  indirizzo text,
  causale text NOT NULL,
  dettagli jsonb NOT NULL,
  emittente jsonb NOT NULL,
  UNIQUE (serie, anno, numero)
);
REVOKE ALL ON roma_rta_private.ricevute_config, roma_rta_private.ricevute_progressivi FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.roma_rta_ricevute ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roma_rta_ricevute FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.roma_rta_ricevute TO authenticated;
CREATE POLICY roma_rta_archivio_ricevute ON public.roma_rta_ricevute FOR SELECT TO authenticated
USING ((SELECT roma_rta_private.operatore_abilitato()));

CREATE FUNCTION public.roma_rta_config_ricevute() RETURNS TABLE (emissione_attiva boolean, serie text, emittente jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.emissione_attiva, c.serie, c.emittente FROM roma_rta_private.ricevute_config c
  WHERE roma_rta_private.operatore_abilitato();
$$;

CREATE FUNCTION public.roma_rta_emetti_ricevuta(
  p_id uuid, p_intestatario text, p_cf text, p_indirizzo text, p_causale text,
  p_importo numeric, p_metodo text, p_data_servizio date, p_serie text, p_dettagli jsonb, p_emittente jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c roma_rta_private.ricevute_config;
  r public.prenotazioni;
  istante timestamptz;
  a integer;
  n integer;
  ricevuta_id uuid;
BEGIN
  IF roma_rta_private.operatore_abilitato() IS NOT TRUE THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.prenotazioni WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prenotazione non disponibile'; END IF;
  SELECT id INTO ricevuta_id FROM public.roma_rta_ricevute WHERE prenotazione_id = p_id;
  IF FOUND THEN RETURN ricevuta_id; END IF;
  SELECT * INTO STRICT c FROM roma_rta_private.ricevute_config FOR SHARE;
  IF NOT c.emissione_attiva THEN RAISE EXCEPTION 'Emissione definitiva disabilitata'; END IF;
  IF r.pagato IS NOT TRUE OR r.costo IS NULL OR r.costo <= 0 OR r.costo::text IN ('NaN', 'Infinity') OR r.annullata_il IS NOT NULL OR r.rimborso_effettuato_il IS NOT NULL THEN
    RAISE EXCEPTION 'Incasso non emettibile';
  END IF;
  IF (r.costo::numeric, r.metodo_pagamento::text, r.data_appuntamento::date, c.serie)
     IS DISTINCT FROM (p_importo, p_metodo, p_data_servizio, p_serie) OR c.emittente IS DISTINCT FROM p_emittente THEN
    RAISE EXCEPTION 'Dati della ricevuta cambiati dopo l''anteprima';
  END IF;
  IF coalesce(length(btrim(p_intestatario)), 0) NOT BETWEEN 1 AND 180 OR coalesce(length(btrim(p_causale)), 0) NOT BETWEEN 1 AND 350
    OR coalesce(length(p_cf), 0) > 24 OR coalesce(length(p_indirizzo), 0) > 220 THEN
    RAISE EXCEPTION 'Dati ricevuta non validi';
  END IF;
  IF p_causale IS NULL OR p_causale NOT IN (
    'Manifestazione sociale', 'Trasporto infermi', 'Donazione', 'Assistenza domiciliare',
    'Trasporto dializzati - disabili', 'Altro'
  ) OR jsonb_typeof(p_dettagli) IS DISTINCT FROM 'object'
    OR length(coalesce(p_dettagli->>'luogo_nascita', '')) > 120
    OR length(coalesce(p_dettagli->>'citta', '')) > 120
    OR coalesce(p_dettagli->>'cap', '') !~ '^([0-9]{5})?$'
    OR length(coalesce(p_dettagli->>'descrizione', '')) > 350
    OR (p_causale = 'Altro' AND nullif(btrim(p_dettagli->>'descrizione'), '') IS NULL)
  THEN RAISE EXCEPTION 'Dati ricevuta non validi'; END IF;
  p_dettagli := jsonb_build_object(
    'data_nascita', nullif(p_dettagli->>'data_nascita', '')::date,
    'luogo_nascita', nullif(btrim(p_dettagli->>'luogo_nascita'), ''),
    'citta', nullif(btrim(p_dettagli->>'citta'), ''),
    'cap', nullif(p_dettagli->>'cap', ''),
    'descrizione', CASE WHEN p_causale = 'Altro' THEN btrim(p_dettagli->>'descrizione') END
  );
  istante := clock_timestamp();
  a := extract(year FROM istante AT TIME ZONE 'Europe/Rome');
  INSERT INTO roma_rta_private.ricevute_progressivi (serie, anno, prossimo)
    VALUES (c.serie, a, CASE WHEN a = 2026 THEN c.iniziale_2026 ELSE c.iniziale_annuale END)
    ON CONFLICT (serie, anno) DO NOTHING;
  SELECT prossimo INTO STRICT n FROM roma_rta_private.ricevute_progressivi
    WHERE serie = c.serie AND anno = a FOR UPDATE;
  WHILE EXISTS (SELECT 1 FROM public.roma_rta_ricevute WHERE serie = c.serie AND anno = a AND numero = n) LOOP
    n := n + 1;
  END LOOP;
  IF n > 99999 THEN RAISE EXCEPTION 'Numerazione ricevute esaurita'; END IF;
  INSERT INTO public.roma_rta_ricevute (
    prenotazione_id, serie, anno, numero, emessa_il, emessa_da, importo, metodo_pagamento,
    data_servizio, intestatario, codice_fiscale, indirizzo, causale, dettagli, emittente
  ) VALUES (
    p_id, c.serie, a, n, istante, auth.uid(), r.costo, r.metodo_pagamento,
    r.data_appuntamento, btrim(p_intestatario), nullif(upper(btrim(p_cf)), ''), nullif(btrim(p_indirizzo), ''), btrim(p_causale),
    p_dettagli, c.emittente
  ) RETURNING id INTO ricevuta_id;
  UPDATE roma_rta_private.ricevute_progressivi SET prossimo = n + 1 WHERE serie = c.serie AND anno = a;
  RETURN ricevuta_id;
END;
$$;
REVOKE ALL ON FUNCTION public.roma_rta_config_ricevute(), public.roma_rta_emetti_ricevuta(uuid, text, text, text, text, numeric, text, date, text, jsonb, jsonb)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roma_rta_config_ricevute(), public.roma_rta_emetti_ricevuta(uuid, text, text, text, text, numeric, text, date, text, jsonb, jsonb) TO authenticated;
COMMIT;
