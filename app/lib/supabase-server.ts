import "server-only";

import { createClient } from "@supabase/supabase-js";

function getServerConfig() {
  // Stesso progetto del client pubblico, ma credenziale esclusivamente privata.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export function isSupabaseServerConfigured() {
  return getServerConfig() !== null;
}

// Factory predisposta per un uso futuro: nessun client viene creato all'import.
// La route di preparazione non richiama questa funzione.
export function createSupabaseServerClient() {
  const config = getServerConfig();
  if (!config) return null;

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
