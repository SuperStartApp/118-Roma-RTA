import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { genera, separaIstruzioni } from "../scripts/prepara-collaudo-tessera.mjs";

const sourcePath = "supabase/migrations/20261109000100_tessera_pubblica.sql";
const outputPath = "supabase/checks/tessera_pubblica_transazionale.sql";
const source = fs.readFileSync(sourcePath, "utf8");
const output = fs.readFileSync(outputPath, "utf8");
const senzaCommenti = s => s.replace(/--[^\n]*(?:\n|$)/g, "").trim();

test("Prova DDL: copia sincronizzata, originale non riscritto e nessuna conferma transazione", () => {
  assert.equal(output, genera(source));
  assert.equal(fs.readFileSync(sourcePath, "utf8"), source);
  assert.ok(output.includes(createHash("sha256").update(source).digest("hex")));
  assert.ok(!/\bCOMMIT\b|\bEND\s+TRANSACTION\b|\bPREPARE\s+TRANSACTION\b/i.test(output));
  const top = separaIstruzioni(output).map(senzaCommenti);
  assert.equal(top[0], "BEGIN;");
  assert.equal(top.at(-1), "ROLLBACK;");
  assert.equal(top.filter(s => s.startsWith("DO ")).length, 1);
  assert.ok(top.every(s => /^(BEGIN;|SET LOCAL |DO |ROLLBACK;)/.test(s)));
});

test("Prova DDL: tutte le istruzioni originali nel sottoblocco annullato, niente chiamate RPC", () => {
  const expected = separaIstruzioni(source).slice(2, -1);
  const actual = [...output.matchAll(/EXECUTE (\$ddl_\d+\$)\n([\s\S]*?)\n\1;/g)].map(m => m[2]);
  assert.deepEqual(actual, expected);
  assert.ok(output.includes("EXCEPTION WHEN SQLSTATE 'ZT001'"));
  const forced = output.indexOf("RAISE EXCEPTION 'Annullamento obbligatorio");
  assert.ok(forced > output.lastIndexOf("    EXECUTE "));
  assert.ok(forced < output.indexOf("EXCEPTION WHEN SQLSTATE 'ZT001'"));
  assert.ok(!/SELECT\s+(?:public\.)?roma_rta_(?:condividi|leggi|revoca)_tessera\s*\(/i.test(output));
  // DML presente soltanto nelle definizioni inerti delle funzioni originali.
  for (const statement of actual) assert.ok(!/^(INSERT|UPDATE|DELETE|TRUNCATE|SELECT|CALL)\b/i.test(senzaCommenti(statement)));
});

test("Prova DDL: timeout locali e blocco event trigger prima del primo DDL", () => {
  assert.ok(output.includes("SET LOCAL lock_timeout = '1s';"));
  assert.ok(output.includes("SET LOCAL statement_timeout = '10s';"));
  assert.ok(output.includes("SET LOCAL idle_in_transaction_session_timeout = '15s';"));
  assert.ok(output.indexOf("FROM pg_catalog.pg_event_trigger") < output.indexOf("    EXECUTE "));
  assert.ok(!/ALTER EVENT TRIGGER|session_replication_role|DISABLE TRIGGER/i.test(output));
});

test("Prova DDL: insieme esatto dei sei trigger, eventi, tag e funzioni verificati", () => {
  const expected = [
    ["issue_graphql_placeholder", "sql_drop", "DROP EXTENSION", "extensions.set_graphql_placeholder()"],
    ["issue_pg_cron_access", "ddl_command_end", "CREATE EXTENSION", "extensions.grant_pg_cron_access()"],
    ["issue_pg_graphql_access", "ddl_command_end", "CREATE EXTENSION", "extensions.grant_pg_graphql_access()"],
    ["issue_pg_net_access", "ddl_command_end", "CREATE EXTENSION", "extensions.grant_pg_net_access()"],
    ["pgrst_ddl_watch", "ddl_command_end", null, "extensions.pgrst_ddl_watch()"],
    ["pgrst_drop_watch", "sql_drop", null, "extensions.pgrst_drop_watch()"],
  ];
  const guard = output.slice(output.indexOf("WITH attesi("), output.indexOf("    EXECUTE "));
  const rows = [...guard.matchAll(/\('([^']+)', '([^']+)', (ARRAY\['([^']+)'\]::text\[\]|NULL::text\[\]), '([^']+)'\)/g)]
    .map(m => [m[1], m[2], m[4] ?? null, m[5]]);
  assert.deepEqual(rows, expected);
  // FULL JOIN rileva anche trigger mancanti; niente filtro che ignori quelli disabilitati.
  assert.ok(guard.includes("FULL JOIN attesi"));
  assert.ok(guard.includes("WHERE a.nome IS NULL OR e.oid IS NULL"));
  for (const predicate of [
    "e.evtevent IS DISTINCT FROM a.evento", "e.evttags IS DISTINCT FROM a.tag",
    "proprietario_trigger.rolname IS DISTINCT FROM 'supabase_admin'",
    "proprietario_funzione.rolname IS DISTINCT FROM 'supabase_admin'",
    "e.evtfoid IS DISTINCT FROM pg_catalog.to_regprocedure(a.funzione)::oid",
    "p.prokind IS DISTINCT FROM 'f'", "p.prorettype IS DISTINCT FROM 'pg_catalog.event_trigger'::regtype",
    "p.pronargs IS DISTINCT FROM 0", "e.evtenabled IS DISTINCT FROM 'O'",
    "IF trigger_inattesi IS NOT NULL THEN", "RAISE EXCEPTION",
  ]) assert.ok(guard.includes(predicate), predicate);
  assert.ok(!guard.includes("evtenabled <> 'D'"));
});

test("Generazione: struttura cambiata o controllo transazione interno fanno fallire la copia", () => {
  assert.throws(() => genera(source.replace("COMMIT;", "ROLLBACK;")));
  assert.throws(() => genera(source.replace("LOCK TABLE", "COMMIT;\nLOCK TABLE")));
  assert.throws(() => separaIstruzioni("DO $$ BEGIN NULL; END;"));
});
