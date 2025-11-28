export interface CategoryGroup {
  id: string;
  label: string;
  order: number;
}

export type TaxTag =
  | 'WERBUNGSKOSTEN'
  | 'SONDERAUSGABEN'
  | 'HAUSHALTSNAHE_DIENSTLEISTUNG'
  | 'SPENDEN'
  | 'PRIVAT'
  | null;

export interface Category {
  id: string;
  groupId: string;
  label: string;
  taxTag: TaxTag;
  isIncome: boolean;
  order: number;
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'essential_living', label: 'Lebenshaltung', order: 1 },
  { id: 'lifestyle', label: 'Lebensstil', order: 2 },
  { id: 'mobility', label: 'Mobilität', order: 3 },
  { id: 'financial', label: 'Finanzen', order: 4 },
  { id: 'income', label: 'Einkommen', order: 5 },
];

export const CATEGORIES: Category[] = [
  // Essential living
  { id: 'housing_rent', groupId: 'essential_living', label: 'Miete & Wohnen', taxTag: 'PRIVAT', isIncome: false, order: 1 },
  { id: 'housing_utilities_energy', groupId: 'essential_living', label: 'Strom & Gas', taxTag: 'PRIVAT', isIncome: false, order: 2 },
  { id: 'housing_utilities_water', groupId: 'essential_living', label: 'Wasser & Abwasser', taxTag: 'PRIVAT', isIncome: false, order: 3 },
  { id: 'housing_service_charges', groupId: 'essential_living', label: 'Nebenkosten & Hausgeld', taxTag: 'PRIVAT', isIncome: false, order: 4 },
  { id: 'housing_insurance_building', groupId: 'essential_living', label: 'Wohngebäudeversicherung', taxTag: 'PRIVAT', isIncome: false, order: 5 },
  { id: 'housing_maintenance_repairs', groupId: 'essential_living', label: 'Instandhaltung & Reparaturen', taxTag: 'HAUSHALTSNAHE_DIENSTLEISTUNG', isIncome: false, order: 6 },
  { id: 'groceries_supermarkets', groupId: 'essential_living', label: 'Lebensmittel (Supermarkt)', taxTag: 'PRIVAT', isIncome: false, order: 7 },
  { id: 'groceries_drugstores', groupId: 'essential_living', label: 'Drogerie & Haushalt', taxTag: 'PRIVAT', isIncome: false, order: 8 },
  { id: 'household_services_cleaning', groupId: 'essential_living', label: 'Haushaltshilfe & Reinigung', taxTag: 'HAUSHALTSNAHE_DIENSTLEISTUNG', isIncome: false, order: 9 },
  { id: 'household_services_handyman', groupId: 'essential_living', label: 'Handwerker & Service', taxTag: 'HAUSHALTSNAHE_DIENSTLEISTUNG', isIncome: false, order: 10 },

  // Lifestyle
  { id: 'lifestyle_restaurants', groupId: 'lifestyle', label: 'Restaurants & Bars', taxTag: 'PRIVAT', isIncome: false, order: 1 },
  { id: 'lifestyle_cafes_bakeries', groupId: 'lifestyle', label: 'Cafés & Bäckereien', taxTag: 'PRIVAT', isIncome: false, order: 2 },
  { id: 'lifestyle_shopping_clothing', groupId: 'lifestyle', label: 'Shopping Kleidung', taxTag: 'PRIVAT', isIncome: false, order: 3 },
  { id: 'lifestyle_shopping_electronics', groupId: 'lifestyle', label: 'Shopping Technik', taxTag: 'PRIVAT', isIncome: false, order: 4 },
  { id: 'lifestyle_subscriptions_streaming', groupId: 'lifestyle', label: 'Abos Streaming & Musik', taxTag: 'PRIVAT', isIncome: false, order: 5 },
  { id: 'lifestyle_subscriptions_media', groupId: 'lifestyle', label: 'Medienbeitrag (GEZ) & Magazine', taxTag: 'PRIVAT', isIncome: false, order: 6 },
  { id: 'lifestyle_fitness_wellness', groupId: 'lifestyle', label: 'Fitness & Wellness', taxTag: 'PRIVAT', isIncome: false, order: 7 },
  { id: 'lifestyle_travel_leisure', groupId: 'lifestyle', label: 'Reisen & Freizeit', taxTag: 'PRIVAT', isIncome: false, order: 8 },
  { id: 'lifestyle_entertainment_events', groupId: 'lifestyle', label: 'Konzerte & Events', taxTag: 'PRIVAT', isIncome: false, order: 9 },
  { id: 'lifestyle_gifts', groupId: 'lifestyle', label: 'Geschenke & Familie', taxTag: 'PRIVAT', isIncome: false, order: 10 },

  // Mobility
  { id: 'mobility_public_transport', groupId: 'mobility', label: 'ÖPNV & Deutschlandticket', taxTag: 'WERBUNGSKOSTEN', isIncome: false, order: 1 },
  { id: 'mobility_commuting_pass', groupId: 'mobility', label: 'Pendlerpauschale / Jobticket', taxTag: 'WERBUNGSKOSTEN', isIncome: false, order: 2 },
  { id: 'mobility_fuel_auto', groupId: 'mobility', label: 'Kraftstoff & Laden', taxTag: 'WERBUNGSKOSTEN', isIncome: false, order: 3 },
  { id: 'mobility_car_maintenance', groupId: 'mobility', label: 'Auto-Wartung & Werkstatt', taxTag: 'PRIVAT', isIncome: false, order: 4 },
  { id: 'mobility_car_insurance', groupId: 'mobility', label: 'Kfz-Versicherung', taxTag: 'PRIVAT', isIncome: false, order: 5 },
  { id: 'mobility_carshare_taxi', groupId: 'mobility', label: 'Carsharing & Taxi', taxTag: 'PRIVAT', isIncome: false, order: 6 },
  { id: 'mobility_bike_mobility', groupId: 'mobility', label: 'Fahrrad & Mikromobilität', taxTag: 'PRIVAT', isIncome: false, order: 7 },
  { id: 'mobility_parking_tolls', groupId: 'mobility', label: 'Parken & Maut', taxTag: 'PRIVAT', isIncome: false, order: 8 },

  // Financial
  { id: 'financial_bank_fees', groupId: 'financial', label: 'Bankgebühren & Kontoführung', taxTag: 'PRIVAT', isIncome: false, order: 1 },
  { id: 'financial_interest_charges', groupId: 'financial', label: 'Zinsen & Kredite', taxTag: 'PRIVAT', isIncome: false, order: 2 },
  { id: 'financial_savings_investments', groupId: 'financial', label: 'Sparen & Investieren', taxTag: null, isIncome: false, order: 3 },
  { id: 'financial_retirement', groupId: 'financial', label: 'Altersvorsorge (Riester/Rürup)', taxTag: 'SONDERAUSGABEN', isIncome: false, order: 4 },
  { id: 'financial_insurance_health', groupId: 'financial', label: 'Krankenversicherung', taxTag: 'SONDERAUSGABEN', isIncome: false, order: 5 },
  { id: 'financial_insurance_liability', groupId: 'financial', label: 'Haftpflicht & Rechtsschutz', taxTag: 'SONDERAUSGABEN', isIncome: false, order: 6 },
  { id: 'financial_insurance_household', groupId: 'financial', label: 'Hausrat & Glas', taxTag: 'PRIVAT', isIncome: false, order: 7 },
  { id: 'financial_donations', groupId: 'financial', label: 'Spenden & gemeinnützige Beiträge', taxTag: 'SPENDEN', isIncome: false, order: 8 },
  { id: 'financial_tax_payments', groupId: 'financial', label: 'Steuern & Abgaben', taxTag: 'PRIVAT', isIncome: false, order: 9 },
  { id: 'financial_household_services', groupId: 'financial', label: 'Haushaltsnahe Dienstleistungen (extern)', taxTag: 'HAUSHALTSNAHE_DIENSTLEISTUNG', isIncome: false, order: 10 },
  { id: 'financial_telecom_internet', groupId: 'financial', label: 'Internet & Telefonie', taxTag: 'PRIVAT', isIncome: false, order: 11 },
  { id: 'financial_cash_withdrawal', groupId: 'financial', label: 'Bargeldabhebungen', taxTag: 'PRIVAT', isIncome: false, order: 12 },

  // Income
  { id: 'income_salary', groupId: 'income', label: 'Gehalt & Lohn', taxTag: null, isIncome: true, order: 1 },
  { id: 'income_bonus', groupId: 'income', label: 'Bonus & Prämien', taxTag: null, isIncome: true, order: 2 },
  { id: 'income_side_hustle', groupId: 'income', label: 'Nebenverdienst & Freelance', taxTag: null, isIncome: true, order: 3 },
  { id: 'income_reimbursement', groupId: 'income', label: 'Erstattungen & Spesen', taxTag: null, isIncome: true, order: 4 },
  { id: 'income_benefits', groupId: 'income', label: 'Leistungen & Zuschüsse', taxTag: null, isIncome: true, order: 5 },
  { id: 'income_tax_refund', groupId: 'income', label: 'Steuererstattungen', taxTag: null, isIncome: true, order: 6 },
  { id: 'income_other', groupId: 'income', label: 'Sonstige Einnahmen', taxTag: null, isIncome: true, order: 7 },
];

const CATEGORY_MAP = new Map(CATEGORIES.map(category => [category.id, category] as const));
const GROUP_ORDER = new Map(CATEGORY_GROUPS.map(group => [group.id, group.order] as const));

export function getGroups(): CategoryGroup[] {
  return CATEGORY_GROUPS.slice().sort((a, b) => a.order - b.order);
}

export function getCategories(): Category[] {
  return CATEGORIES.slice().sort((a, b) => {
    if (a.groupId === b.groupId) return a.order - b.order;
    return (GROUP_ORDER.get(a.groupId) ?? 0) - (GROUP_ORDER.get(b.groupId) ?? 0);
  });
}

export function getCategoryById(id: string): Category | undefined {
  return CATEGORY_MAP.get(id);
}


