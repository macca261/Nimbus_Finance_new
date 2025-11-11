const normalize = (input?: string | null): string | null => {
  if (!input) return null;
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/["'*_+^\-]/g, ' ')
    .replace(/[\p{Diacritic}]/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const MERCHANT_ALIASES_RAW: Record<string, string> = {
  // Groceries & drugstores
  rewe: 'rewe',
  edeka: 'edeka',
  aldi: 'aldi',
  lidl: 'lidl',
  netto: 'netto',
  penny: 'penny',
  dm: 'dm',
  rossmann: 'rossmann',
  mueller: 'mueller',
  kaufland: 'kaufland',
  globus: 'globus',
  tegut: 'tegut',

  // Dining / delivery
  lieferando: 'lieferando',
  wolt: 'wolt',
  mcdonalds: 'mcdonalds',
  burgerking: 'burgerking',
  deananddavid: 'deananddavid',

  // Transport
  deutschebahn: 'deutsche_bahn',
  db: 'deutsche_bahn',
  flixbus: 'flixbus',
  flixtrain: 'flixtrain',
  uber: 'uber',
  bolt: 'bolt',
  taxi: 'taxi',

  // Car / fuel
  shell: 'shell',
  aral: 'aral',
  esso: 'esso',
  total: 'total',
  jet: 'jet',
  hem: 'hem',

  // Shopping
  amazon: 'amazon',
  ikea: 'ikea',
  zalando: 'zalando',
  saturn: 'saturn',
  mediamarkt: 'mediamarkt',
  apple: 'apple',
  otto: 'otto',

  // Subscriptions / streaming
  netflix: 'netflix',
  spotify: 'spotify',
  disneyplus: 'disney_plus',
  disney: 'disney_plus',
  dazn: 'dazn',
  wow: 'sky_wow',
  audible: 'audible',
  gym: 'fitness_studio',
  fitx: 'fitness_studio',
  mcfit: 'fitness_studio',

  // Telecom / internet
  telekom: 'telekom',
  deutschetelekom: 'telekom',
  vodafone: 'vodafone',
  o2: 'o2',
  ound1: '1und1',
  '1und1': '1und1',
  congstar: 'congstar',
  freenet: 'freenet',

  // Insurance
  allianz: 'allianz',
  huk: 'huk',
  hukcoburg: 'huk',
  axa: 'axa',
  debeka: 'debeka',
  signaliduna: 'signal_iduna',
  cosmosdirekt: 'cosmosdirekt',

  // Finance / savings
  traderepublic: 'trade_republic',
  scalabledr: 'scalable_capital',
  scalable: 'scalable_capital',
  flatex: 'flatex',
  justtrade: 'justtrade',

  // Public sector / taxes
  finanzamt: 'finanzamt',
  zoll: 'zoll',

  // Fees
  postbank: 'postbank',
  sparkasse: 'sparkasse',
  commerzbank: 'commerzbank',
  deutschebank: 'deutsche_bank',

  // Cash / ATM
  geldautomat: 'atm',
  atm: 'atm',
  bargeldauszahlung: 'atm',
};

const MERCHANT_ALIAS_MAP: Record<string, string> = Object.keys(MERCHANT_ALIASES_RAW).reduce((acc, key) => {
  const normalized = normalize(key);
  if (normalized) {
    acc[normalized] = MERCHANT_ALIASES_RAW[key];
  }
  return acc;
}, {} as Record<string, string>);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalizeMerchant(value?: string | null): string | null {
  return normalize(value);
}

export function resolveMerchantAlias(value?: string | null): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  for (const [key, alias] of Object.entries(MERCHANT_ALIAS_MAP)) {
    const pattern = new RegExp(`(?:^|\s)${escapeRegex(key)}(?:\s|$)`);
    if (pattern.test(normalized)) {
      return alias;
    }
  }
  return normalized;
}


