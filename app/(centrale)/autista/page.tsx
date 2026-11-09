import Link from "next/link";

// Il vecchio login PIN non crea una sessione Supabase Auth e resta sospeso.
export default function AutistaLogin() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-800">
        <h1 className="text-xl font-bold text-blue-950">Accesso autisti temporaneamente sospeso</h1>
        <p className="mt-3 text-sm leading-relaxed">Il login PIN non è attivo. Per le corse assegnate contatta la centrale operativa.</p>
        <Link href="/login" className="mt-5 inline-flex min-h-11 items-center font-semibold text-blue-700">Accesso centrale</Link>
      </section>
    </div>
  );
}
