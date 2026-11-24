type Autista = { id: string; nome: string; cognome: string };

export default function AutistiAggiuntivi({ autisti, ids, principale, disabilitato, onChange }: {
  autisti: Autista[];
  ids: string[];
  principale: string | null;
  disabilitato?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const disponibili = autisti.filter(({ id }) => id !== principale && !ids.includes(id));
  return (
    <div className="space-y-1 text-xs">
      {ids.map((id) => {
        const autista = autisti.find((item) => item.id === id);
        return <div key={id} className="flex items-center gap-2">
          <span>{autista ? `${autista.nome} ${autista.cognome}` : "Autista assegnato"}</span>
          <button type="button" disabled={disabilitato} onClick={() => onChange(ids.filter((item) => item !== id))}
            className="text-blue-800 underline disabled:opacity-40">Rimuovi</button>
        </div>;
      })}
      {principale && disponibili.length > 0 && <select aria-label="Aggiungi autista" value="" disabled={disabilitato}
        onChange={(event) => event.target.value && onChange([...ids, event.target.value])}
        className="w-full rounded-lg border border-slate-200 bg-white p-2">
        <option value="">Aggiungi autista</option>
        {disponibili.map((a) => <option key={a.id} value={a.id}>{a.nome} {a.cognome}</option>)}
      </select>}
    </div>
  );
}
