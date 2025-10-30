import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { AUTH_DEV_BYPASS, DEV_ADMIN_EMAIL, JWT_SECRET } from '../config/env';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const emailNorm = email.trim().toLowerCase();
    if (password.length < 3) return res.status(400).json({ error: 'Password too short' });

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email: emailNorm, passwordHash } });

    return res.status(201).json({ id: user.id, email: user.email });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Signup error:', err?.message || err);
    // Prisma unique constraint code: P2002
    const code = err?.code || '';
    if (code === 'P2002') return res.status(409).json({ error: 'Email already registered' });
    return res.status(500).json({ error: 'Signup failed', details: err?.message || 'Unknown error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const emailNorm = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials', details: 'User not found' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials', details: 'Wrong password' });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration' });
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });

    return res.json({ token });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Login error:', err?.message || err);
    return res.status(500).json({ error: 'Login failed', details: err?.message || 'Unknown error' });
  }
});

export default router;

// Dev-only login to set session cookie
router.post('/dev-login', async (_req, res) => {
  if (!AUTH_DEV_BYPASS) return res.status(404).json({ error: 'Not found' });
  const user = await prisma.user.findUnique({ where: { email: DEV_ADMIN_EMAIL } });
  if (!user) return res.status(500).json({ error: 'Dev user not seeded' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  return res.json({ ok: true, user: { id: user.id, email: user.email }, token });
});


