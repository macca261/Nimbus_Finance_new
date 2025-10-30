import { prisma } from '../db/prisma';

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h >>> 0) * 0x01000193;
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}

export function computeAdapterHash(headers: string[], sampleValues: string[]): string {
  const normHeaders = headers.map(h => (h || '').trim().toLowerCase()).sort();
  const normSample = sampleValues.map(v => (v || '').trim()).slice(0, 3);
  return fnv1a(JSON.stringify({ h: normHeaders, s: normSample }));
}

export async function getMatchingAdapter(userId: string, hash: string): Promise<any | null> {
  const row = await prisma.customAdapter.findUnique({ where: { userId_hash: { userId, hash } } as any });
  if (!row) return null;
  try { return JSON.parse(row.json); } catch { return null; }
}

export async function saveAdapter(userId: string, hash: string, name: string, adapterJson: any): Promise<void> {
  await prisma.customAdapter.upsert({
    where: { userId_hash: { userId, hash } } as any,
    create: { userId, hash, name, json: JSON.stringify(adapterJson) },
    update: { name, json: JSON.stringify(adapterJson) },
  });
}


