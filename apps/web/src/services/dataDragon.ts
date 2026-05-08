const fallbackVersion = '15.5.1';

export interface ChampionCatalogEntry {
  id: string;
  key: number;
  name: string;
  title: string;
  tags: string[];
}

export type ChampionCatalogMap = Record<number, ChampionCatalogEntry>;

export interface ItemCatalogEntry {
  id: number;
  name: string;
  plaintext: string;
}

export type ItemCatalogMap = Record<number, ItemCatalogEntry>;

export interface SummonerSpellCatalogEntry {
  id: number;
  key: string;
  name: string;
  description: string;
  image: string;
}

export type SummonerSpellCatalogMap = Record<number, SummonerSpellCatalogEntry>;

export interface RuneCatalogEntry {
  id: number;
  key: string;
  name: string;
  icon: string;
  slot: 'style' | 'rune';
}

export type RuneCatalogMap = Record<number, RuneCatalogEntry>;

export interface ChampionSpellEntry {
  id: string;
  name: string;
  description: string;
  image: string;
}

export interface ChampionDetails {
  id: string;
  key: number;
  name: string;
  spells: ChampionSpellEntry[];
}

interface DataDragonChampionResponse {
  data: Record<
    string,
    {
      id: string;
      key: string;
      name: string;
      title: string;
      tags: string[];
    }
  >;
}

interface DataDragonItemResponse {
  data: Record<
    string,
    {
      name: string;
      plaintext?: string;
    }
  >;
}

interface DataDragonSummonerSpellResponse {
  data: Record<
    string,
    {
      key: string;
      name: string;
      description?: string;
      image: {
        full: string;
      };
    }
  >;
}

interface DataDragonRuneResponseItem {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: Array<{
    runes: Array<{
      id: number;
      key: string;
      icon: string;
      name: string;
    }>;
  }>;
}

interface DataDragonChampionDetailsResponse {
  data: Record<
    string,
    {
      id: string;
      key: string;
      name: string;
      spells: Array<{
        id: string;
        name: string;
        description?: string;
        image: {
          full: string;
        };
      }>;
    }
  >;
}

export const getLatestDataDragonVersion = async () => {
  try {
    const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!response.ok) return fallbackVersion;
    const versions = (await response.json()) as string[];
    return versions[0] ?? fallbackVersion;
  } catch {
    return fallbackVersion;
  }
};

export const championIconUrl = (version: string | undefined, championId: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/img/champion/${championId}.png`;

export const championSplashUrl = (championId: string) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`;

export const itemIconUrl = (version: string | undefined, itemId: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/img/item/${itemId}.png`;

export const profileIconUrl = (version: string | undefined, profileIconId: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/img/profileicon/${profileIconId}.png`;

export const summonerSpellIconUrl = (version: string | undefined, image: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/img/spell/${image}`;

export const championSpellIconUrl = (version: string | undefined, image: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/img/spell/${image}`;

export const runeIconUrl = (icon: string) => `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;

export const getChampionCatalog = async (version?: string): Promise<ChampionCatalogMap> => {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/data/es_MX/champion.json`);
    if (!response.ok) return {};

    const payload = (await response.json()) as DataDragonChampionResponse;
    return Object.values(payload.data).reduce<ChampionCatalogMap>((catalog, champion) => {
      catalog[Number(champion.key)] = {
        id: champion.id,
        key: Number(champion.key),
        name: champion.name,
        title: champion.title,
        tags: champion.tags
      };
      return catalog;
    }, {});
  } catch {
    return {};
  }
};

export const getItemCatalog = async (version?: string): Promise<ItemCatalogMap> => {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/data/es_MX/item.json`);
    if (!response.ok) return {};

    const payload = (await response.json()) as DataDragonItemResponse;
    return Object.entries(payload.data).reduce<ItemCatalogMap>((catalog, [id, item]) => {
      catalog[Number(id)] = {
        id: Number(id),
        name: item.name,
        plaintext: item.plaintext ?? ''
      };
      return catalog;
    }, {});
  } catch {
    return {};
  }
};

export const getSummonerSpellCatalog = async (version?: string): Promise<SummonerSpellCatalogMap> => {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/data/es_MX/summoner.json`);
    if (!response.ok) return {};

    const payload = (await response.json()) as DataDragonSummonerSpellResponse;
    return Object.entries(payload.data).reduce<SummonerSpellCatalogMap>((catalog, [key, spell]) => {
      catalog[Number(spell.key)] = {
        id: Number(spell.key),
        key,
        name: spell.name,
        description: spell.description ?? '',
        image: spell.image.full
      };
      return catalog;
    }, {});
  } catch {
    return {};
  }
};

export const getRuneCatalog = async (version?: string): Promise<RuneCatalogMap> => {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/data/es_MX/runesReforged.json`);
    if (!response.ok) return {};

    const payload = (await response.json()) as DataDragonRuneResponseItem[];
    return payload.reduce<RuneCatalogMap>((catalog, style) => {
      catalog[style.id] = {
        id: style.id,
        key: style.key,
        name: style.name,
        icon: style.icon,
        slot: 'style'
      };

      style.slots.forEach((slot) => {
        slot.runes.forEach((rune) => {
          catalog[rune.id] = {
            id: rune.id,
            key: rune.key,
            name: rune.name,
            icon: rune.icon,
            slot: 'rune'
          };
        });
      });

      return catalog;
    }, {});
  } catch {
    return {};
  }
};

export const getChampionDetails = async (championKey: string, version?: string): Promise<ChampionDetails | null> => {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/data/es_MX/champion/${championKey}.json`);
    if (!response.ok) return null;

    const payload = (await response.json()) as DataDragonChampionDetailsResponse;
    const champion = payload.data[championKey];
    if (!champion) return null;

    return {
      id: champion.id,
      key: Number(champion.key),
      name: champion.name,
      spells: champion.spells.map((spell) => ({
        id: spell.id,
        name: spell.name,
        description: spell.description ?? '',
        image: spell.image.full
      }))
    };
  } catch {
    return null;
  }
};
