import { isSupabaseServerConfigured } from "@/app/lib/supabase-server";

export async function POST() {
  // Endpoint intenzionalmente inattivo: non legge il PIN e non crea client DB.
  // Anche con la configurazione presente, nessuna operazione viene abilitata.
  const configured = isSupabaseServerConfigured();

  return Response.json(
    {
      success: false,
      code: configured ? "FEATURE_DISABLED" : "SERVICE_UNAVAILABLE",
      message: configured
        ? "La conferma incasso non è ancora attiva."
        : "La conferma incasso non è disponibile.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
