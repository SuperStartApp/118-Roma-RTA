// Generazione locale: nessuna connessione al database e nessuna esecuzione SQL.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function separaIstruzioni(sql) {
  const result = [];
  let start = 0, quote = null, block = 0, line = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i], next = sql[i + 1];
    if (line) { if (ch === "\n") line = false; continue; }
    if (block) {
      if (ch === "/" && next === "*") { block++; i++; }
      else if (ch === "*" && next === "/") { block--; i++; }
      continue;
    }
    if (quote) {
      if (quote === "'" || quote === '"') {
        if (ch === quote && next === quote) i++;
        else if (ch === quote) quote = null;
      } else if (sql.startsWith(quote, i)) { i += quote.length - 1; quote = null; }
      continue;
    }
    if (ch === "-" && next === "-") { line = true; i++; }
    else if (ch === "/" && next === "*") { block = 1; i++; }
    else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "$") {
      const tag = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
      if (tag) { quote = tag; i += tag.length - 1; }
    } else if (ch === ";") { result.push(sql.slice(start, i + 1).trim()); start = i + 1; }
  }
  if (quote || block || sql.slice(start).trim()) throw new Error("SQL non terminato o delimitatori incompleti");
  return result;
}

export function genera(source) {
  const statements = separaIstruzioni(source);
  const first = statements.shift();
  if (!first.replace(/--[^\n]*(?:\n|$)/g, "").trim().match(/^BEGIN;$/i)
    || statements.shift() !== "SET LOCAL lock_timeout = '5s';"
    || statements.pop() !== "COMMIT;") throw new Error("Struttura migrazione inattesa");
  if (statements.some(s => /\b(?:COMMIT|ROLLBACK|PREPARE TRANSACTION|dblink|nextval|setval)\b/i.test(s))) throw new Error("Istruzione non ammessa nel corpo");
  const commands = statements.map((sql, i) => {
    const tag = `$ddl_${String(i + 1).padStart(3, "0")}$`;
    if (sql.includes(tag)) throw new Error("Collisione delimitatore");
    return `    EXECUTE ${tag}\n${sql}\n${tag};`;
  }).join("\n\n");
  const hash = createHash("sha256").update(source).digest("hex");
  return `-- ROMA R.T.A. - PROVA TRANSAZIONALE DDL, NON ESEGUITA.
-- Fonte: supabase/migrations/20261109000100_tessera_pubblica.sql
-- SHA256 fonte: ${hash}
-- Copia generata da scripts/prepara-collaudo-tessera.mjs.
-- Eseguire soltanto integralmente in una sessione dedicata, senza altro lavoro pendente.
-- Nessun dato paziente letto/modificato e nessuna RPC applicativa invocata.
-- Consente solo i sei event trigger Supabase verificati dall'amministratore.
-- Verifica nome, evento, proprietari, tag e identita della funzione, senza modificarli.
-- issue_* limitati alle estensioni; pgrst_* con NOTIFY transazionale, come verificato.
-- Non effettuare modifiche amministrative concorrenti ai trigger o alle funzioni.
-- Il DDL e temporaneo ma i lock possono bloccare brevemente altre applicazioni.
-- Il precedente rifiuto generale descritto nella guida e sostituito dai controlli sotto.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog;

DO $prova_tessera$
DECLARE
  esito text;
  trigger_inattesi text;
BEGIN
  -- Solo cataloghi prima del DDL. Insieme esatto: anche trigger extra disabilitati
  -- o trigger attesi mancanti fanno interrompere la prova. NULL significa nessun filtro tag.
  WITH attesi(nome, evento, tag, funzione) AS (VALUES
    ('issue_graphql_placeholder', 'sql_drop', ARRAY['DROP EXTENSION']::text[], 'extensions.set_graphql_placeholder()'),
    ('issue_pg_cron_access', 'ddl_command_end', ARRAY['CREATE EXTENSION']::text[], 'extensions.grant_pg_cron_access()'),
    ('issue_pg_graphql_access', 'ddl_command_end', ARRAY['CREATE EXTENSION']::text[], 'extensions.grant_pg_graphql_access()'),
    ('issue_pg_net_access', 'ddl_command_end', ARRAY['CREATE EXTENSION']::text[], 'extensions.grant_pg_net_access()'),
    ('pgrst_ddl_watch', 'ddl_command_end', NULL::text[], 'extensions.pgrst_ddl_watch()'),
    ('pgrst_drop_watch', 'sql_drop', NULL::text[], 'extensions.pgrst_drop_watch()')
  )
  SELECT pg_catalog.string_agg(COALESCE(e.evtname::text, a.nome), ', '
    ORDER BY COALESCE(e.evtname::text, a.nome)) INTO trigger_inattesi
  FROM pg_catalog.pg_event_trigger e
  FULL JOIN attesi a ON a.nome = e.evtname::text
  LEFT JOIN pg_catalog.pg_roles proprietario_trigger ON proprietario_trigger.oid = e.evtowner
  LEFT JOIN pg_catalog.pg_proc p ON p.oid = e.evtfoid
  LEFT JOIN pg_catalog.pg_roles proprietario_funzione ON proprietario_funzione.oid = p.proowner
  WHERE a.nome IS NULL OR e.oid IS NULL
    OR e.evtevent IS DISTINCT FROM a.evento
    OR e.evttags IS DISTINCT FROM a.tag
    OR proprietario_trigger.rolname IS DISTINCT FROM 'supabase_admin'
    OR proprietario_funzione.rolname IS DISTINCT FROM 'supabase_admin'
    OR e.evtfoid IS DISTINCT FROM pg_catalog.to_regprocedure(a.funzione)::oid
    OR p.prokind IS DISTINCT FROM 'f'
    OR p.prorettype IS DISTINCT FROM 'pg_catalog.event_trigger'::regtype
    OR p.pronargs IS DISTINCT FROM 0
    OR e.evtenabled IS DISTINCT FROM 'O';
  IF trigger_inattesi IS NOT NULL THEN
    RAISE EXCEPTION 'Event trigger mancanti, inattesi o con configurazione diversa: %. Prova non eseguita', trigger_inattesi;
  END IF;
  BEGIN
${commands}

    -- Solo metadati degli oggetti temporaneamente creati, mai righe paziente.
    SELECT pg_catalog.format('DDL e controlli privilegi completati. Tabella RLS: %s; trigger: %s',
      (SELECT c.relrowsecurity FROM pg_catalog.pg_class c
        WHERE c.oid = 'roma_rta_private.tessere_condivisioni'::regclass),
      (SELECT t.tgenabled FROM pg_catalog.pg_trigger t
        WHERE t.tgrelid = 'public.pazienti'::regclass AND t.tgname = 'roma_rta_revoca_link_tessera'))
    INTO esito;
    -- Eccezione intenzionale: annulla tutto il sottoblocco DDL prima di uscire.
    -- Protegge anche dall'omissione accidentale dell'ultima istruzione del file.
    RAISE EXCEPTION 'Annullamento obbligatorio del DDL di prova' USING ERRCODE = 'ZT001';
  EXCEPTION WHEN SQLSTATE 'ZT001' THEN
    RAISE NOTICE '%; sottoblocco DDL gia annullato. Nessuna prova funzionale delle RPC.', esito;
  END;
  IF pg_catalog.to_regclass('roma_rta_private.tessere_condivisioni') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.roma_rta_condividi_tessera(uuid,text)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.roma_rta_revoca_tessera(uuid)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.roma_rta_leggi_tessera(text)') IS NOT NULL
    OR pg_catalog.to_regprocedure('roma_rta_private.revoca_tessera_modificata()') IS NOT NULL THEN
    RAISE EXCEPTION 'Oggetti inattesi dopo annullamento: fermarsi e verificare';
  END IF;
END;
$prova_tessera$;
ROLLBACK;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const source = fs.readFileSync("supabase/migrations/20261109000100_tessera_pubblica.sql", "utf8");
  fs.writeFileSync("supabase/checks/tessera_pubblica_transazionale.sql", genera(source));
}
