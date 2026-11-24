-- Solo per il cluster sintetico avviato per tests/nuove-funzioni-db.mjs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END;
$$;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;

CREATE TABLE public.pazienti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  cognome text,
  numero_tessera integer,
  anno_tessera integer,
  data_tesseramento date
);
CREATE TABLE public.autisti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  cognome text,
  telefono text,
  attivo boolean DEFAULT true,
  pin text NOT NULL,
  numero_tessera integer,
  anno_tessera integer
);
CREATE TABLE public.prenotazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paziente_id uuid REFERENCES public.pazienti(id),
  autista_id uuid REFERENCES public.autisti(id),
  data_appuntamento date,
  ora_appuntamento time,
  serve_ossigeno boolean,
  serve_medico boolean,
  note text,
  partenza_citta text,
  partenza_via text,
  partenza_civico text,
  partenza_piano text,
  partenza_interno text,
  partenza_ascensore boolean,
  partenza_dettagli_ospedale text,
  arrivo_citta text,
  arrivo_via text,
  arrivo_civico text,
  arrivo_piano text,
  arrivo_interno text,
  arrivo_ascensore boolean,
  arrivo_dettagli_ospedale text,
  costo numeric,
  ore_incluse numeric,
  costo_ora_supplementare numeric,
  metodo_pagamento text,
  pagato boolean,
  ora_inizio_effettiva timestamptz,
  ora_fine_effettiva timestamptz
);
CREATE TABLE public.drive_test_isolamento (id integer PRIMARY KEY);
INSERT INTO public.drive_test_isolamento VALUES (1);
GRANT SELECT ON public.drive_test_isolamento TO anon;
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['pazienti', 'prenotazioni', 'autisti'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
    EXECUTE format('CREATE POLICY "Permetti tutto a tutti per ora" ON public.%I USING (true) WITH CHECK (true)', tab);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', tab);
  END LOOP;
END;
$$;
GRANT UPDATE (ora_inizio_effettiva, ora_fine_effettiva) ON public.prenotazioni TO service_role;
CREATE FUNCTION public.genera_prossima_tessera(text, integer) RETURNS integer LANGUAGE sql AS $$ SELECT $2 $$;
