import { NextFunction, Request, Response } from 'express';
import { validRegions } from '../utils/region.js';
import { AppError } from '../utils/errors.js';

export const validateRegion = (req: Request, _res: Response, next: NextFunction) => {
  const region = req.params.region;

  if (!validRegions.includes(region)) {
    next(new AppError(`Región inválida: ${region}`, 400, 'INVALID_REGION'));
    return;
  }

  next();
};
