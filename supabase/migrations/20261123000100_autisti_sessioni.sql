-- ROMA R.T.A. - migrazione gia installata il 24/11/2026.
-- Conservare nel repository. NON rieseguire sul database ufficiale.
DO $installazione$
BEGIN
 SET LOCAL lock_timeout = '5s';
 SET LOCAL statement_timeout = '120s';
 LOCK TABLE public.autisti IN ACCESS EXCLUSIVE MODE;
 IF EXISTS (SELECT 1 FROM public.autisti WHERE pin IS NULL OR pin !~ '^[0-9]{4,6}$') THEN RAISE EXCEPTION 'PIN originali non validi'; END IF;
 IF EXISTS (SELECT pin FROM public.autisti WHERE attivo IS TRUE GROUP BY pin HAVING count(*) > 1) THEN RAISE EXCEPTION 'PIN attivi duplicati'; END IF;
 CREATE TABLE roma_rta_private.autista_credenziali (autista_id uuid PRIMARY KEY REFERENCES public.autisti(id) ON DELETE CASCADE, pin_hash text NOT NULL, aggiornato_il timestamptz NOT NULL DEFAULT now());
 CREATE TABLE roma_rta_private.autista_sessioni (token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'), autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE, scade_il timestamptz NOT NULL, creato_il timestamptz NOT NULL DEFAULT now());
 CREATE INDEX roma_rta_autista_sessioni_id_idx ON roma_rta_private.autista_sessioni(autista_id);
 CREATE TABLE roma_rta_private.autista_tentativi (chiave text PRIMARY KEY, finestra timestamptz NOT NULL DEFAULT now(), tentativi integer NOT NULL DEFAULT 0);
 ALTER TABLE roma_rta_private.autista_credenziali ENABLE ROW LEVEL SECURITY;
 ALTER TABLE roma_rta_private.autista_sessioni ENABLE ROW LEVEL SECURITY;
 ALTER TABLE roma_rta_private.autista_tentativi ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON roma_rta_private.autista_credenziali, roma_rta_private.autista_sessioni, roma_rta_private.autista_tentativi FROM PUBLIC, anon, authenticated, service_role;
 INSERT INTO roma_rta_private.autista_credenziali (autista_id,pin_hash) SELECT id, extensions.crypt(pin,extensions.gen_salt('bf',12)) FROM public.autisti;
 IF EXISTS (SELECT 1 FROM public.autisti a LEFT JOIN roma_rta_private.autista_credenziali c ON c.autista_id=a.id WHERE c.pin_hash IS NULL OR c.pin_hash <> extensions.crypt(a.pin,c.pin_hash)) THEN RAISE EXCEPTION 'Verifica credenziali fallita'; END IF;
 UPDATE public.autisti SET pin='';
 ALTER TABLE public.autisti ADD CONSTRAINT roma_rta_pin_legacy_vuoto CHECK (pin='');
 CREATE FUNCTION public.roma_rta_autista_registra(p_nome text,p_cognome text,p_telefono text,p_pin text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
 DECLARE v_id uuid;
 BEGIN
 IF roma_rta_private.operatore_abilitato() IS NOT TRUE THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
 IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'PIN non valido'; END IF;
 IF nullif(btrim(p_nome),'') IS NULL OR nullif(btrim(p_cognome),'') IS NULL THEN RAISE EXCEPTION 'Nome e cognome obbligatori'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(11820261124);
 IF EXISTS (SELECT 1 FROM roma_rta_private.autista_credenziali c WHERE c.pin_hash=extensions.crypt(p_pin,c.pin_hash)) THEN RAISE EXCEPTION 'PIN gia utilizzato'; END IF;
 INSERT INTO public.autisti(nome,cognome,telefono,pin,attivo) VALUES(btrim(p_nome),btrim(p_cognome),p_telefono,'',true) RETURNING id INTO v_id;
 INSERT INTO roma_rta_private.autista_credenziali(autista_id,pin_hash) VALUES(v_id,extensions.crypt(p_pin,extensions.gen_salt('bf',12)));
 RETURN v_id;
 END; $fn$;
 CREATE FUNCTION public.roma_rta_autista_rigenera_pin(p_autista_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
 DECLARE v_pin text; v_bytes bytea; v_num integer;
 BEGIN
 IF roma_rta_private.operatore_abilitato() IS NOT TRUE THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(11820261124);
 PERFORM 1 FROM public.autisti WHERE id=p_autista_id AND attivo IS TRUE FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Autista non disponibile'; END IF;
 LOOP
 v_bytes:=extensions.gen_random_bytes(3);
 v_num:=get_byte(v_bytes,0)*65536+get_byte(v_bytes,1)*256+get_byte(v_bytes,2);
 CONTINUE WHEN v_num>=16000000;
 v_pin:=lpad((v_num%1000000)::text,6,'0');
 EXIT WHEN NOT EXISTS (SELECT 1 FROM roma_rta_private.autista_credenziali c WHERE c.pin_hash=extensions.crypt(v_pin,c.pin_hash));
 END LOOP;
 INSERT INTO roma_rta_private.autista_credenziali(autista_id,pin_hash) VALUES(p_autista_id,extensions.crypt(v_pin,extensions.gen_salt('bf',12))) ON CONFLICT (autista_id) DO UPDATE SET pin_hash=EXCLUDED.pin_hash,aggiornato_il=now();
 DELETE FROM roma_rta_private.autista_sessioni WHERE autista_id=p_autista_id;
 RETURN v_pin;
 END; $fn$;
 CREATE FUNCTION roma_rta_private.revoca_sessioni_autista() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
 BEGIN
 IF NEW.attivo IS NOT TRUE THEN DELETE FROM roma_rta_private.autista_sessioni WHERE autista_id=NEW.id; END IF;
 RETURN NEW;
 END; $fn$;
 CREATE TRIGGER roma_rta_revoca_sessioni AFTER UPDATE OF attivo ON public.autisti FOR EACH ROW EXECUTE FUNCTION roma_rta_private.revoca_sessioni_autista();
 CREATE FUNCTION public.roma_rta_autista_login(p_pin text,p_ip_hash text,p_token_hash text) RETURNS TABLE(autista_id uuid,nome text,cognome text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
 DECLARE v_id uuid; v_chiave text; v_tentativi integer; v_limite integer;
 BEGIN
 IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,6}$' OR p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(11820261124);
 DELETE FROM roma_rta_private.autista_sessioni WHERE scade_il<=now();
 DELETE FROM roma_rta_private.autista_tentativi WHERE finestra<now()-interval '1 day';
 FOREACH v_chiave IN ARRAY ARRAY['globale',p_ip_hash] LOOP
 v_limite:=CASE WHEN v_chiave='globale' THEN 20 ELSE 5 END;
 INSERT INTO roma_rta_private.autista_tentativi(chiave,finestra,tentativi) VALUES(v_chiave,now(),0) ON CONFLICT (chiave) DO NOTHING;
 UPDATE roma_rta_private.autista_tentativi SET finestra=now(),tentativi=0 WHERE chiave=v_chiave AND finestra<now()-interval '15 minutes';
 SELECT t.tentativi INTO v_tentativi FROM roma_rta_private.autista_tentativi t WHERE t.chiave=v_chiave;
 IF v_tentativi>=v_limite THEN RETURN; END IF;
 END LOOP;
 UPDATE roma_rta_private.autista_tentativi SET tentativi=tentativi+1 WHERE chiave IN ('globale',p_ip_hash);
 SELECT a.id INTO v_id FROM public.autisti a JOIN roma_rta_private.autista_credenziali c ON c.autista_id=a.id WHERE a.attivo IS TRUE AND c.pin_hash=extensions.crypt(p_pin,c.pin_hash) LIMIT 1 FOR UPDATE OF a;
 IF v_id IS NULL THEN RETURN; END IF;
 INSERT INTO roma_rta_private.autista_sessioni(token_hash,autista_id,scade_il) VALUES(p_token_hash,v_id,now()+interval '12 hours');
 UPDATE roma_rta_private.autista_tentativi SET tentativi=greatest(tentativi-1,0) WHERE chiave IN ('globale',p_ip_hash);
 RETURN QUERY SELECT a.id,a.nome::text,a.cognome::text FROM public.autisti a WHERE a.id=v_id;
 END; $fn$;
 CREATE FUNCTION public.roma_rta_autista_sessione(p_token_hash text) RETURNS TABLE(autista_id uuid,nome text,cognome text,numero_tessera integer,anno_tessera integer) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $fn$
 SELECT a.id,a.nome::text,a.cognome::text,a.numero_tessera,a.anno_tessera FROM roma_rta_private.autista_sessioni s JOIN public.autisti a ON a.id=s.autista_id WHERE s.token_hash=p_token_hash AND s.scade_il>now() AND a.attivo IS TRUE LIMIT 1
 $fn$;
 CREATE FUNCTION public.roma_rta_autista_logout(p_token_hash text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $fn$
 DELETE FROM roma_rta_private.autista_sessioni WHERE token_hash=p_token_hash
 $fn$;
 REVOKE ALL ON FUNCTION public.roma_rta_autista_registra(text,text,text,text),public.roma_rta_autista_rigenera_pin(uuid) FROM PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION public.roma_rta_autista_registra(text,text,text,text),public.roma_rta_autista_rigenera_pin(uuid) TO authenticated;
 REVOKE ALL ON FUNCTION public.roma_rta_autista_login(text,text,text),public.roma_rta_autista_sessione(text),public.roma_rta_autista_logout(text) FROM PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION public.roma_rta_autista_login(text,text,text),public.roma_rta_autista_sessione(text),public.roma_rta_autista_logout(text) TO service_role;
 REVOKE ALL ON FUNCTION roma_rta_private.revoca_sessioni_autista() FROM PUBLIC,anon,authenticated,service_role;
 IF (SELECT count(*) FROM public.autisti) <> (SELECT count(*) FROM roma_rta_private.autista_credenziali) THEN RAISE EXCEPTION 'Migrazione incompleta'; END IF;
 NOTIFY pgrst,'reload schema';
END $installazione$;
