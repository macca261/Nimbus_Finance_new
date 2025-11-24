/**
 * Central category registry - single source of truth for category IDs and metadata.
 * All category IDs used in tests and rules should be defined here.
 */

export type CategoryId =
  | 'groceries'
  | 'transport:rideshare'
  | 'transport:public'
  | 'transport:fuel'
  | 'income:salary'
  | 'income:freelance'
  | 'income:refunds'
  | 'fees:bank'
  | 'fees:service'
  | 'subscriptions:streaming'
  | 'subscriptions:software'
  | 'subscriptions:telecom'
  | 'subscriptions:transport'
  | 'savings'
  | 'savings:brokerage'
  | 'savings:pension'
  | 'housing:rent'
  | 'housing:mortgage'
  | 'housing:utilities'
  | 'utilities:energy'
  | 'utilities:internet'
  | 'health'
  | 'health:insurance'
  | 'health:medical'
  | 'health:pharmacy'
  | 'leisure:restaurants'
  | 'leisure:travel'
  | 'dining'
  | 'dining:cafe'
  | 'dining:delivery'
  | 'dining:bakery'
  | 'dining:fast_food'
  | 'shopping'
  | 'shopping:electronics'
  | 'shopping:home'
  | 'shopping:home_improvement'
  | 'shopping:discount_store'
  | 'insurance'
  | 'insurance:travel'
  | 'travel:holiday'
  | 'education'
  | 'taxes'
  | 'charity'
  | 'internal:own-account'
  | 'internal:savings'
  | 'internal:wallet'
  | 'internal:transfer_savings'
  | 'internal:transfer_wallet'
  | 'internal:transfer_other'
  | 'cash:withdrawal'
  | 'other';

export interface CategoryMeta {
  id: CategoryId;
  labelDe: string;
  parentId?: CategoryId | null;
  isIncome?: boolean;
  isTransfer?: boolean;
  isEssential?: boolean;
}

const REGISTRY: Record<CategoryId, CategoryMeta> = {
  groceries: {
    id: 'groceries',
    labelDe: 'Lebensmittel & Supermarkt',
    isEssential: true,
  },
  'transport:rideshare': {
    id: 'transport:rideshare',
    labelDe: 'Transport – Ride-Hailing',
    isEssential: false,
  },
  'transport:public': {
    id: 'transport:public',
    labelDe: 'ÖPNV & Bahn',
    isEssential: true,
  },
  'transport:fuel': {
    id: 'transport:fuel',
    labelDe: 'Kraftstoff',
    isEssential: false,
  },
  'income:salary': {
    id: 'income:salary',
    labelDe: 'Gehalt & Lohn',
    isIncome: true,
    isEssential: true,
  },
  'income:freelance': {
    id: 'income:freelance',
    labelDe: 'Freelance & Honorar',
    isIncome: true,
    isEssential: false,
  },
  'income:refunds': {
    id: 'income:refunds',
    labelDe: 'Erstattungen',
    isIncome: true,
    isEssential: false,
  },
  'fees:bank': {
    id: 'fees:bank',
    labelDe: 'Bankgebühren',
    isEssential: false,
  },
  'fees:service': {
    id: 'fees:service',
    labelDe: 'Servicegebühren',
    isEssential: false,
  },
  'subscriptions:streaming': {
    id: 'subscriptions:streaming',
    labelDe: 'Streaming-Abos',
    isEssential: false,
  },
  'subscriptions:software': {
    id: 'subscriptions:software',
    labelDe: 'Software-Abos',
    isEssential: false,
  },
  'subscriptions:telecom': {
    id: 'subscriptions:telecom',
    labelDe: 'Telekommunikation',
    isEssential: true,
  },
  'subscriptions:transport': {
    id: 'subscriptions:transport',
    labelDe: 'Transport-Abos',
    isEssential: false,
  },
  savings: {
    id: 'savings',
    labelDe: 'Sparen & Rücklagen',
    isEssential: true,
  },
  'savings:brokerage': {
    id: 'savings:brokerage',
    labelDe: 'Depot & Brokerage',
    isEssential: false,
  },
  'savings:pension': {
    id: 'savings:pension',
    labelDe: 'Rente & Vorsorge',
    isEssential: true,
  },
  'housing:rent': {
    id: 'housing:rent',
    labelDe: 'Miete',
    isEssential: true,
  },
  'housing:mortgage': {
    id: 'housing:mortgage',
    labelDe: 'Hypothek',
    isEssential: true,
  },
  'housing:utilities': {
    id: 'housing:utilities',
    labelDe: 'Wohnnebenkosten',
    isEssential: true,
  },
  'utilities:energy': {
    id: 'utilities:energy',
    labelDe: 'Strom & Gas',
    isEssential: true,
  },
  'utilities:internet': {
    id: 'utilities:internet',
    labelDe: 'Internet & Telefon',
    isEssential: true,
  },
  health: {
    id: 'health',
    labelDe: 'Gesundheit',
    isEssential: false,
  },
  'health:insurance': {
    id: 'health:insurance',
    labelDe: 'Krankenversicherung',
    isEssential: true,
  },
  'health:medical': {
    id: 'health:medical',
    labelDe: 'Medizin & Arzt',
    isEssential: false,
  },
  'health:pharmacy': {
    id: 'health:pharmacy',
    labelDe: 'Apotheke',
    isEssential: false,
  },
  'leisure:restaurants': {
    id: 'leisure:restaurants',
    labelDe: 'Restaurants & Cafés',
    isEssential: false,
  },
  'leisure:travel': {
    id: 'leisure:travel',
    labelDe: 'Reisen & Urlaub',
    isEssential: false,
  },
  dining: {
    id: 'dining',
    labelDe: 'Gastronomie',
    isEssential: false,
  },
  'dining:cafe': {
    id: 'dining:cafe',
    labelDe: 'Café & Bäckerei',
    isEssential: false,
  },
  'dining:delivery': {
    id: 'dining:delivery',
    labelDe: 'Essenslieferung',
    isEssential: false,
  },
  'dining:bakery': {
    id: 'dining:bakery',
    labelDe: 'Bäckerei',
    isEssential: false,
  },
  'dining:fast_food': {
    id: 'dining:fast_food',
    labelDe: 'Fast Food / Schnellimbiss',
    isEssential: false,
  },
  shopping: {
    id: 'shopping',
    labelDe: 'Einkauf',
    isEssential: false,
  },
  'shopping:electronics': {
    id: 'shopping:electronics',
    labelDe: 'Elektronik',
    isEssential: false,
  },
  'shopping:home': {
    id: 'shopping:home',
    labelDe: 'Möbel & Wohnen',
    isEssential: false,
  },
  'shopping:home_improvement': {
    id: 'shopping:home_improvement',
    labelDe: 'Baumarkt & Heimwerken',
    isEssential: false,
  },
  'shopping:discount_store': {
    id: 'shopping:discount_store',
    labelDe: 'Discount-Shop / Action',
    isEssential: false,
  },
  insurance: {
    id: 'insurance',
    labelDe: 'Versicherungen',
    isEssential: false,
  },
  'insurance:travel': {
    id: 'insurance:travel',
    labelDe: 'Reiseversicherung',
    isEssential: false,
  },
  'travel:holiday': {
    id: 'travel:holiday',
    labelDe: 'Reisen & Urlaub',
    isEssential: false,
  },
  education: {
    id: 'education',
    labelDe: 'Bildung',
    isEssential: false,
  },
  taxes: {
    id: 'taxes',
    labelDe: 'Steuern & Abgaben',
    isEssential: false,
  },
  charity: {
    id: 'charity',
    labelDe: 'Spenden',
    isEssential: false,
  },
  'internal:own-account': {
    id: 'internal:own-account',
    labelDe: 'Eigene Übertragung',
    isTransfer: true,
    isEssential: false,
  },
  'internal:savings': {
    id: 'internal:savings',
    labelDe: 'Sparen (intern)',
    isTransfer: true,
    isEssential: false,
  },
  'internal:wallet': {
    id: 'internal:wallet',
    labelDe: 'Wallet (intern)',
    isTransfer: true,
    isEssential: false,
  },
  'internal:transfer_savings': {
    id: 'internal:transfer_savings',
    labelDe: 'Interner Transfer – Sparen',
    isTransfer: true,
    isEssential: false,
  },
  'internal:transfer_wallet': {
    id: 'internal:transfer_wallet',
    labelDe: 'Interner Transfer – Wallet',
    isTransfer: true,
    isEssential: false,
  },
  'internal:transfer_other': {
    id: 'internal:transfer_other',
    labelDe: 'Interner Transfer',
    isTransfer: true,
    isEssential: false,
  },
  'cash:withdrawal': {
    id: 'cash:withdrawal',
    labelDe: 'Bargeldabhebung',
    isEssential: false,
  },
  other: {
    id: 'other',
    labelDe: 'Sonstiges',
    isEssential: false,
  },
};

/**
 * Get metadata for a category ID.
 */
export function getCategoryMeta(id: CategoryId): CategoryMeta {
  return REGISTRY[id];
}

/**
 * List all categories.
 */
export function listCategories(): CategoryMeta[] {
  return Object.values(REGISTRY);
}

/**
 * Check if a category ID is valid.
 */
export function isValidCategoryId(id: string): id is CategoryId {
  return id in REGISTRY;
}

