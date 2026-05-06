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

export const itemIconUrl = (version: string | undefined, itemId: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/img/item/${itemId}.png`;

export const profileIconUrl = (version: string | undefined, profileIconId: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${version ?? fallbackVersion}/img/profileicon/${profileIconId}.png`;

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
