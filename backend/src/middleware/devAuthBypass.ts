import { NextFunction, Response } from 'express';
import type { AuthRequest } from './authMiddleware';
import { AUTH_DEV_BYPASS, DEV_ADMIN_EMAIL, JWT_SECRET } from '../config/env';
import { prisma } from '../db/prisma';
import jwt from 'jsonwebtoken';

export async function devAuthBypass(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!AUTH_DEV_BYPASS) return next();
    if (req.headers.authorization) return next();
    const user = await prisma.user.findUnique({ where: { email: DEV_ADMIN_EMAIL } });
    if (!user) return next();
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    req.headers.authorization = `Bearer ${token}`;
    return next();
  } catch {
    return next();
  }
}


