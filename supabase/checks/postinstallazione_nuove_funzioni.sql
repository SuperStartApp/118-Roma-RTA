-- Eseguire dopo le tre migrazioni, come amministratore e prima della pubblicazione.
WITH tessere AS (
  SELECT iniziale_2026, iniziale_annuale, accetta_legacy FROM roma_rta_private.tessere_config WHERE unico
),
ricevute AS (
  SELECT iniziale_2026, iniziale_annuale, emissione_attiva, serie FROM roma_rta_private.ricevute_config WHERE unico
),
backfill AS (
  SELECT count(*) AS assegnate, count(*) FILTER (WHERE a.prenotazione_id IS NULL) AS mancanti
  FROM public.prenotazioni p
  LEFT JOIN public.roma_rta_prenotazioni_autisti a ON a.prenotazione_id = p.id AND a.autista_id = p.autista_id
  WHERE p.autista_id IS NOT NULL
),
relazioni AS (
  SELECT count(*) AS dirette,
    coalesce(bool_and(convalidated AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (autista_id)%'), false) AS valida,
    EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'p' AND c.conrelid = 'public.roma_rta_prenotazioni_autisti'::regclass
        AND a.attname IN ('autista_id','prenotazione_id')
    ) AS chiave_implicita
  FROM pg_constraint
  WHERE contype = 'f' AND conrelid = 'public.prenotazioni'::regclass AND confrelid = 'public.autisti'::regclass
),
esiti(controllo, esito, motivazione) AS (
  SELECT 'Numerazione tessere',
    CASE WHEN EXISTS (SELECT 1 FROM tessere WHERE iniziale_2026 = 500 AND iniziale_annuale = 1) THEN 'PASS' ELSE 'FAIL' END,
    coalesce((SELECT format('Valori configurati: 2026 = %s, anni successivi = %s. Attesi 500 e 1.', iniziale_2026, iniziale_annuale) FROM tessere),
      'Configurazione tessere mancante.')
  UNION ALL
  SELECT 'Compatibilità tessere prima della pubblicazione',
    CASE WHEN EXISTS (SELECT 1 FROM tessere WHERE accetta_legacy) THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN EXISTS (SELECT 1 FROM tessere WHERE accetta_legacy) THEN 'Il vecchio client può salvare tessere durante il passaggio.'
      ELSE 'La compatibilità transitoria è disattiva o non configurata. Verificare che i vecchi client siano stati aggiornati.' END
  UNION ALL
  SELECT 'Numerazione ed emissione ricevute',
    CASE WHEN EXISTS (SELECT 1 FROM ricevute WHERE NOT emissione_attiva AND iniziale_2026 = 500 AND iniziale_annuale = 1) THEN 'PASS' ELSE 'FAIL' END,
    coalesce((SELECT format('Valori configurati: 2026 = %s, anni successivi = %s, emissione reale = %s, serie = %s. Attesi 500, 1 ed emissione disabilitata.',
      iniziale_2026, iniziale_annuale, CASE WHEN emissione_attiva THEN 'attiva' ELSE 'disabilitata' END,
      coalesce(nullif(serie,''),'non impostata')) FROM ricevute), 'Configurazione ricevute mancante.')
  UNION ALL
  SELECT 'Backfill autisti', CASE WHEN mancanti = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('Prenotazioni con autista principale: %s. Collegamenti mancanti: %s.', assegnate, mancanti)
  FROM backfill
  UNION ALL
  SELECT 'Lettura legacy corsa → autista',
    CASE WHEN dirette = 1 AND valida AND NOT chiave_implicita THEN 'PASS' ELSE 'FAIL' END,
    format('FK dirette: %s; FK legacy valida: %s; chiave primaria del ponte composta da FK: %s. Attese una sola FK diretta valida e una chiave del ponte separata.',
      dirette, valida, chiave_implicita)
  FROM relazioni
  UNION ALL
  SELECT 'Permessi archivio, assegnazioni e marcature',
    CASE WHEN NOT has_table_privilege('anon', 'public.roma_rta_ricevute', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.roma_rta_ricevute', 'INSERT,UPDATE,DELETE')
      AND NOT has_table_privilege('anon', 'public.roma_rta_prenotazioni_autisti', 'SELECT')
      AND NOT has_column_privilege('authenticated','public.prenotazioni','ora_inizio_effettiva','UPDATE')
      AND NOT has_column_privilege('authenticated','public.prenotazioni','ora_fine_effettiva','UPDATE')
      AND NOT has_function_privilege('authenticated','public.roma_rta_registra_ora(uuid,uuid,text)','EXECUTE')
      AND NOT has_function_privilege('anon','public.roma_rta_registra_ora(uuid,uuid,text)','EXECUTE')
      AND has_function_privilege('service_role','public.roma_rta_registra_ora(uuid,uuid,text)','EXECUTE')
    THEN 'PASS' ELSE 'FAIL' END,
    'Attesi archivio senza scrittura diretta, dati non accessibili ad anon e RPC orari riservata a service_role.'
  UNION ALL
  SELECT 'RLS e trigger attivi',
    CASE WHEN (SELECT count(*) = 2 FROM pg_class WHERE oid IN ('public.roma_rta_ricevute'::regclass, 'public.roma_rta_prenotazioni_autisti'::regclass) AND relrowsecurity)
      AND (SELECT count(*) = 2 FROM pg_trigger WHERE NOT tgisinternal AND tgenabled IN ('O','A')
        AND ((tgrelid = 'public.pazienti'::regclass AND tgname = 'roma_rta_numerazione_tessera')
          OR (tgrelid = 'public.prenotazioni'::regclass AND tgname = 'roma_rta_autista_principale')))
    THEN 'PASS' ELSE 'FAIL' END,
    'Attese RLS su ricevute e collegamenti autisti, e trigger di numerazione tessere e sincronizzazione autista principale attivi.'
)
SELECT controllo, esito, motivazione
FROM esiti
ORDER BY CASE esito WHEN 'FAIL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, controllo;
