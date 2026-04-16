import { PlatformRegion } from '../types/riot.js';

const platformToRegionalMap: Record<PlatformRegion, 'americas' | 'europe' | 'asia' | 'sea'> = {
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  kr: 'asia',
  jp1: 'asia',
  oc1: 'sea'
};

export const getRegionalRouting = (region: PlatformRegion) => platformToRegionalMap[region];

export const validRegions = Object.keys(platformToRegionalMap);
