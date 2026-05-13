import { FormEvent, useMemo, useState } from 'react';

interface SearchBarProps {
  onSearch: (args: { region: string; gameName: string; tagLine: string }) => void;
  isLoading?: boolean;
  initialRegion?: string;
  initialRiotId?: string;
}

const regions = [
  { value: 'na1', label: 'NA - Norteamerica' },
  { value: 'la1', label: 'LAN - Latinoamerica Norte' },
  { value: 'la2', label: 'LAS - Latinoamerica Sur' },
  { value: 'br1', label: 'BR - Brasil' },
  { value: 'euw1', label: 'EUW - Europa Oeste' },
  { value: 'eun1', label: 'EUNE - Europa Nordic/East' },
  { value: 'kr', label: 'KR - Corea' },
  { value: 'jp1', label: 'JP - Japon' },
  { value: 'oc1', label: 'OCE - Oceania' },
  { value: 'tr1', label: 'TR - Turquia' },
  { value: 'ru', label: 'RU - Rusia' }
];

const cleanRiotIdPart = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim();

const parseRiotId = (value: string) => {
  const cleaned = cleanRiotIdPart(value);
  const hashIndex = cleaned.lastIndexOf('#');

  if (hashIndex === -1) {
    return {
      gameName: cleaned,
      tagLine: ''
    };
  }

  return {
    gameName: cleanRiotIdPart(cleaned.slice(0, hashIndex)),
    tagLine: cleanRiotIdPart(cleaned.slice(hashIndex + 1))
  };
};

export const SearchBar = ({ onSearch, isLoading, initialRegion = 'na1', initialRiotId = '' }: SearchBarProps) => {
  const [region, setRegion] = useState(initialRegion);
  const [riotId, setRiotId] = useState(initialRiotId);
  const [showSplitFields, setShowSplitFields] = useState(false);
  const [manualGameName, setManualGameName] = useState('');
  const [manualTagLine, setManualTagLine] = useState('');
  const [submitError, setSubmitError] = useState('');

  const parsed = useMemo(() => parseRiotId(riotId), [riotId]);
  const gameName = showSplitFields ? cleanRiotIdPart(manualGameName) : parsed.gameName;
  const tagLine = showSplitFields ? cleanRiotIdPart(manualTagLine).replace(/^#/, '') : cleanRiotIdPart(parsed.tagLine).replace(/^#/, '');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!gameName || !tagLine) {
      setSubmitError('Escribe el Riot ID completo, por ejemplo: Faker#KR1. El nombre va antes del # y el TAG va despues.');
      return;
    }

    setSubmitError('');
    onSearch({
      region,
      gameName,
      tagLine
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800/90 bg-zinc-950/85 p-4 shadow-xl shadow-black/25">
      <div className="grid gap-3 lg:grid-cols-[0.7fr_1.4fr_auto]">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Region del servidor
          <select
            className="min-h-10 rounded-md border border-zinc-700 bg-black/35 px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none transition focus:border-teal-400"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            {regions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {!showSplitFields ? (
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Riot ID completo
            <input
              className="min-h-10 rounded-md border border-zinc-700 bg-black/35 px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-teal-400"
              placeholder="Nombre#TAG, ejemplo: Hide on bush#KR1"
              value={riotId}
              onChange={(event) => {
                setRiotId(event.target.value);
                setSubmitError('');
              }}
            />
          </label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_0.55fr]">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Nombre, antes del #
              <input
                className="min-h-10 rounded-md border border-zinc-700 bg-black/35 px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-teal-400"
                placeholder="Ejemplo: Hide on bush"
                value={manualGameName}
                onChange={(event) => {
                  setManualGameName(event.target.value);
                  setSubmitError('');
                }}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              TAG, despues del #
              <input
                className="min-h-10 rounded-md border border-zinc-700 bg-black/35 px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-teal-400"
                placeholder="Ejemplo: KR1"
                value={manualTagLine}
                onChange={(event) => {
                  setManualTagLine(event.target.value);
                  setSubmitError('');
                }}
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="min-h-10 self-end rounded-md bg-teal-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Buscando...' : 'Buscar jugador'}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Formato: <span className="font-semibold text-zinc-200">Nombre</span>
          <span className="font-semibold text-teal-300">#</span>
          <span className="font-semibold text-zinc-200">TAG</span>. Ejemplo: <span className="font-semibold text-zinc-200">Hide on bush#KR1</span>.
        </p>
        <button
          type="button"
          className="w-fit rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-teal-300 hover:text-teal-200"
          onClick={() => {
            setShowSplitFields((current) => {
              const next = !current;
              if (next) {
                setManualGameName(parsed.gameName);
                setManualTagLine(parsed.tagLine);
              } else {
                const nextRiotId = gameName && tagLine ? `${gameName}#${tagLine}` : cleanRiotIdPart(riotId);
                setRiotId(nextRiotId);
              }
              setSubmitError('');
              return next;
            });
          }}
        >
          {showSplitFields ? 'Usar campo Nombre#TAG' : 'Separar nombre y TAG'}
        </button>
      </div>

      {submitError && <p className="mt-3 rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">{submitError}</p>}
    </form>
  );
};
