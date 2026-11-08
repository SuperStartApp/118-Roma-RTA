-- PROPOSTA NON ESEGUITA. Verificare prima lo schema del database di destinazione.
-- Non modifica costo, pagato o altri dati storici; non cambia policy o permessi.
-- NOT VALID conserva eventuali incoerenze storiche: la validazione completa
-- richiede una verifica separata. I vincoli valgono per nuovi INSERT e UPDATE.
-- Verificare la definizione di eventuali vincoli omonimi prima di applicare.
-- Il rimborso integrale deriva da costo: questa migrazione NON impedisce
-- modifiche successive a costo, revoche dell'annullamento o DELETE del record.

BEGIN;

ALTER TABLE public.prenotazioni
  ADD COLUMN IF NOT EXISTS annullata_il timestamptz,
  ADD COLUMN IF NOT EXISTS rimborso_effettuato_il timestamptz;

DO $$
BEGIN
  -- IF NOT EXISTS non garantisce il tipo di colonne gia presenti.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.prenotazioni'::regclass
      AND attname IN ('annullata_il', 'rimborso_effettuato_il')
      AND NOT attisdropped
      AND atttypid <> 'timestamptz'::regtype
  ) THEN
    RAISE EXCEPTION 'Colonne annullamento/rimborso esistenti con tipo incompatibile: verificare lo schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.prenotazioni'::regclass
      AND conname = 'prenotazioni_rimborso_richiede_annullamento'
  ) THEN
    ALTER TABLE public.prenotazioni
      ADD CONSTRAINT prenotazioni_rimborso_richiede_annullamento
      CHECK (rimborso_effettuato_il IS NULL OR annullata_il IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.prenotazioni'::regclass
      AND conname = 'prenotazioni_rimborso_richiede_pagamento'
  ) THEN
    ALTER TABLE public.prenotazioni
      ADD CONSTRAINT prenotazioni_rimborso_richiede_pagamento
      CHECK (rimborso_effettuato_il IS NULL OR pagato IS TRUE)
      NOT VALID;
  END IF;
END;
$$;

COMMIT;
