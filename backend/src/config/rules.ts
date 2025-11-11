import type { CategoryId } from '../types/category';

export interface CategoryRule {
  id: string;
  category: CategoryId;
  match: {
    merchantIncludes?: string[];
    textIncludes?: string[];
    regex?: RegExp;
    minAmount?: number;
    maxAmount?: number;
    direction?: 'in' | 'out';
  };
  weight?: number;
  reason: string;
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    id: 'salary_keywords',
    category: 'income_salary',
    match: {
      textIncludes: ['gehalt', 'lohn', 'payroll', 'salary'],
      direction: 'in',
      minAmount: 800,
    },
    weight: 4,
    reason: 'Gehalt/Lohn Stichwort und positive Zahlung',
  },
  {
    id: 'salary_employer',
    category: 'income_salary',
    match: {
      textIncludes: ['gmbh', 'ag', 'kg'],
      direction: 'in',
      minAmount: 1500,
    },
    weight: 2,
    reason: 'Hohe positive Zahlung mit Unternehmenskennzeichen',
  },
  {
    id: 'groceries_merchants',
    category: 'groceries',
    match: {
      merchantIncludes: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'dm', 'rossmann', 'mueller', 'kaufland', 'globus', 'tegut'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Lebensmittel- oder Drogeriehändler erkannt',
  },
  {
    id: 'groceries_keywords',
    category: 'groceries',
    match: {
      textIncludes: [
        'supermarkt',
        'lebensmittel',
        'rewe',
        'edeka',
        'aldi',
        'lidl',
        'netto',
        'penny',
        'dm ',
        'rossmann',
        'kaufland',
        'globus',
        'tegut',
      ],
      direction: 'out',
    },
    weight: 2,
    reason: 'Lebensmittel-Schlüsselwort',
  },
  {
    id: 'dining_keywords',
    category: 'dining_out',
    match: {
      textIncludes: ['restaurant', 'imbiss', 'bistro', 'cafe', 'bar', 'lieferando', 'wolt', 'mcdonald', 'burger king'],
      direction: 'out',
    },
    reason: 'Gastronomie oder Lieferdienst erkannt',
  },
  {
    id: 'transport_merchants',
    category: 'transport',
    match: {
      merchantIncludes: ['deutsche_bahn', 'flixbus', 'flixtrain', 'uber', 'bolt', 'taxi'],
      direction: 'out',
    },
    weight: 3,
    reason: 'ÖPNV- oder Mobility-Anbieter',
  },
  {
    id: 'car_fuel',
    category: 'car',
    match: {
      merchantIncludes: ['shell', 'aral', 'esso', 'total', 'jet', 'hem'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Tankstelle erkannt',
  },
  {
    id: 'subscriptions',
    category: 'subscriptions',
    match: {
      merchantIncludes: ['netflix', 'spotify', 'disney_plus', 'dazn', 'sky_wow', 'audible', 'fitness_studio'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Abo-/Streaming-Anbieter',
  },
  {
    id: 'telecom',
    category: 'telecom_internet',
    match: {
      merchantIncludes: ['telekom', 'vodafone', 'o2', '1und1', 'congstar', 'freenet'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Telekommunikationsanbieter erkannt',
  },
  {
    id: 'insurance_merchants',
    category: 'insurance',
    match: {
      merchantIncludes: ['allianz', 'huk', 'axa', 'debeka', 'signal_iduna', 'cosmosdirekt'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Versicherer erkannt',
  },
  {
    id: 'insurance_keywords',
    category: 'insurance',
    match: {
      textIncludes: ['versicherung', 'police'],
      direction: 'out',
    },
    reason: 'Versicherungs-Schlüsselwort',
  },
  {
    id: 'rent_keywords',
    category: 'rent',
    match: {
      textIncludes: ['miete', 'hausverwaltung', 'kaltmiete', 'warmmiete'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Miete erkannt',
  },
  {
    id: 'utilities_keywords',
    category: 'utilities',
    match: {
      textIncludes: ['strom', 'gas', 'wasser', 'energie', 'stadtwerke'],
      direction: 'out',
    },
    reason: 'Versorger-Schlüsselwort',
  },
  {
    id: 'health_keywords',
    category: 'other_review',
    match: {
      textIncludes: ['apotheke', 'arzt', 'praxis', 'zahnarzt'],
      direction: 'out',
    },
    reason: 'Gesundheitsausgabe',
  },
  {
    id: 'taxes_keywords',
    category: 'taxes',
    match: {
      merchantIncludes: ['finanzamt', 'zoll'],
      textIncludes: ['steuer'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Steuern/Zoll',
  },
  {
    id: 'fees_keywords',
    category: 'fees_charges',
    match: {
      textIncludes: ['gebühr', 'gebuehr', 'kartenentgelt', 'dispozins', 'kontoführung', 'kontoentgelt'],
      direction: 'out',
      maxAmount: 80,
    },
    weight: 2.5,
    reason: 'Bankgebühren erkannt',
  },
  {
    id: 'savings_keywords',
    category: 'savings_investments',
    match: {
      merchantIncludes: ['trade_republic', 'scalable_capital', 'flatex', 'justtrade'],
    },
    reason: 'Broker oder Sparplan',
  },
  {
    id: 'cash_withdrawal_keywords',
    category: 'cash_withdrawal',
    match: {
      textIncludes: ['bargeldauszahlung', 'atm', 'geldautomat', 'cash group', 'cashgroup'],
      direction: 'out',
    },
    weight: 3,
    reason: 'Bargeldabhebung',
  },
  {
    id: 'transfer_internal_keywords',
    category: 'transfer_internal',
    match: {
      textIncludes: [
        'ubertrag',
        'uebertrag',
        'übertrag',
        'umbuchung',
        'eigene konto',
        'eigenes konto',
        'eigenen konto',
        'eigene kontonummer',
        'hausintern',
        'interne buchung',
        'own account',
      ],
      direction: 'out',
    },
    weight: 4,
    reason: 'Interner Übertrag / Umbuchung',
  },
  {
    id: 'transfer_internal_sepa',
    category: 'transfer_internal',
    match: {
      regex: /sepa[-\s]?(?:ue|u|ü)berweisung.*(eigene(?:s|n)? konto|kontonummer|hausintern|intern)/,
      direction: 'out',
    },
    weight: 4.5,
    reason: 'SEPA-Überweisung auf eigenes Konto',
  },
  {
    id: 'transfer_external_keywords',
    category: 'other_review',
    match: {
      textIncludes: ['sepa', 'überweisung', 'ueberweisung'],
    },
    reason: 'Externe Überweisung',
  },
  {
    id: 'savings_positive',
    category: 'savings_investments',
    match: {
      direction: 'in',
      textIncludes: ['sparplan', 'anlage', 'investment'],
    },
    reason: 'Spar-/Investmentzufluss',
  },
];

export const RULE_SCORE_THRESHOLD = 1.5;


