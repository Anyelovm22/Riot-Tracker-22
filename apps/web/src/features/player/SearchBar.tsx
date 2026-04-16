import { FormEvent, useState } from 'react';

interface SearchBarProps {
  onSearch: (args: { region: string; gameName: string; tagLine: string }) => void;
  isLoading?: boolean;
}

export const SearchBar = ({ onSearch, isLoading }: SearchBarProps) => {
  const [region, setRegion] = useState('na1');
  const [gameName, setGameName] = useState('');
  const [tagLine, setTagLine] = useState('NA1');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!gameName.trim() || !tagLine.trim()) return;

    onSearch({
      region,
      gameName: gameName.trim(),
      tagLine: tagLine.trim()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-4">
      <select
        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
      >
        {['na1', 'euw1', 'eun1', 'kr', 'br1', 'la1', 'la2', 'oc1', 'jp1'].map((option) => (
          <option value={option} key={option}>
            {option.toUpperCase()}
          </option>
        ))}
      </select>
      <input
        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        placeholder="Game Name"
        value={gameName}
        onChange={(e) => setGameName(e.target.value)}
      />
      <input
        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        placeholder="Tag"
        value={tagLine}
        onChange={(e) => setTagLine(e.target.value)}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold transition hover:bg-brand-500 disabled:opacity-50"
      >
        {isLoading ? 'Buscando...' : 'Buscar jugador'}
      </button>
    </form>
  );
};
