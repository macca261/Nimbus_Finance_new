export type NimbusCategoryId = string;

export interface NimbusCategory {
  id: NimbusCategoryId;
  parentId?: NimbusCategoryId;
  label: string;
}

export const NIMBUS_TAXONOMY_V1: NimbusCategory[] = [
  { id: 'income', label: 'Einnahmen' },
  { id: 'income:salary', parentId: 'income', label: 'Gehalt & Lohn' },
  { id: 'income:freelance', parentId: 'income', label: 'Freelance & Selbstständig' },
  { id: 'income:refunds', parentId: 'income', label: 'Erstattungen & Rückzahlungen' },

  { id: 'housing', label: 'Wohnen' },
  { id: 'housing:rent', parentId: 'housing', label: 'Miete' },
  { id: 'housing:utilities', parentId: 'housing', label: 'Nebenkosten & Versorger' },
  { id: 'housing:mortgage', parentId: 'housing', label: 'Hypothek & Baufinanzierung' },

  { id: 'groceries', label: 'Lebensmittel' },
  { id: 'dining', label: 'Restaurants & Lieferdienste' },
  { id: 'dining:delivery', parentId: 'dining', label: 'Lieferdienste & Take-out' },
  { id: 'dining:cafe', parentId: 'dining', label: 'Café & Bäckerei' },

  { id: 'transport', label: 'Transport' },
  { id: 'transport:public', parentId: 'transport', label: 'ÖPNV & Bahn' },
  { id: 'transport:fuel', parentId: 'transport', label: 'Tanken' },
  { id: 'transport:rideshare', parentId: 'transport', label: 'Ride-Sharing & Taxi' },
  { id: 'transport:mobility', parentId: 'transport', label: 'Mikromobilität & Sharing' },

  { id: 'subscriptions', label: 'Abos' },
  { id: 'subscriptions:streaming', parentId: 'subscriptions', label: 'Streaming' },
  { id: 'subscriptions:software', parentId: 'subscriptions', label: 'Software & Tools' },
  { id: 'subscriptions:telecom', parentId: 'subscriptions', label: 'Telefon & Internet' },

  { id: 'shopping', label: 'Shopping & Konsum' },
  { id: 'shopping:electronics', parentId: 'shopping', label: 'Elektronik & Technik' },
  { id: 'shopping:home', parentId: 'shopping', label: 'Haushalt & Möbel' },

  { id: 'health', label: 'Gesundheit' },
  { id: 'insurance', label: 'Versicherungen' },
  { id: 'education', label: 'Bildung & Weiterentwicklung' },

  { id: 'fees', label: 'Gebühren' },
  { id: 'fees:bank', parentId: 'fees', label: 'Bankgebühren' },
  { id: 'fees:service', parentId: 'fees', label: 'Service- & Vertragsgebühren' },

  { id: 'taxes', label: 'Steuern & Abgaben' },
  { id: 'savings', label: 'Sparen & Investments' },
  { id: 'savings:brokerage', parentId: 'savings', label: 'Brokerage & Trading' },
  { id: 'savings:pension', parentId: 'savings', label: 'Rente & Vorsorge' },

  { id: 'internal', label: 'Interne Umbuchungen' },
  { id: 'internal:own-account', parentId: 'internal', label: 'Eigene Konten' },
  { id: 'internal:savings', parentId: 'internal', label: 'Umbuchung Sparen' },

  { id: 'charity', label: 'Spenden & Gemeinnütziges' },

  { id: 'other', label: 'Sonstiges' },
];

export const isValidCategoryId = (id: string): id is NimbusCategoryId =>
  NIMBUS_TAXONOMY_V1.some(category => category.id === id);

