import { Request, Response } from 'express';
import { riotService } from '../services/riotService.js';
import { PlatformRegion } from '../types/riot.js';

const parseRegion = (value: string) => value as PlatformRegion;

export const riotController = {
  async profile(req: Request, res: Response) {
    const { region, gameName, tagLine } = req.params;
    const profile = await riotService.getProfile(parseRegion(region), gameName, tagLine);
    res.json(profile);
  },

  async ranked(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const ranked = await riotService.getRanked(parseRegion(region), puuid);
    res.json(ranked);
  },

  async history(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const count = Number(req.query.count ?? 10);
    const history = await riotService.getMatchHistory(parseRegion(region), puuid, count);
    res.json(history);
  },

  async match(req: Request, res: Response) {
    const { region, matchId } = req.params;
    const match = await riotService.getMatch(parseRegion(region), matchId);
    res.json(match);
  },

  async live(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const live = await riotService.getLiveGame(parseRegion(region), puuid);
    res.json(live);
  },

  async mastery(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const count = Number(req.query.count ?? 8);
    const mastery = await riotService.getChampionMastery(parseRegion(region), puuid, count);
    res.json(mastery);
  },

  async summary(req: Request, res: Response) {
    const { region, gameName, tagLine } = req.params;
    const summary = await riotService.getPlayerSummary(parseRegion(region), gameName, tagLine);
    res.json(summary);
  }
};
