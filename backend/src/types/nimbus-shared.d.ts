declare module '@nimbus/shared/src/categorisation' {
  export type CategorySource = 'RULE' | 'MODEL' | 'LLM' | 'USER';

  export interface CategoryDecision {
    id: string;
    transactionId: string;
    categoryId: string;
    confidence: number;
    source: CategorySource;
    modelVersion?: string | null;
    ruleId?: string | null;
    createdAt: string;
  }
}

declare module '@nimbus/shared/src/types/canonical' {
  export interface CanonicalTransaction {
    id: string;
    bookingDate: string;
    valueDate?: string;
    amount: number;
    currency: string;
    counterpartName?: string;
    counterpartIban?: string;
    counterpartBic?: string;
    purpose?: string;
    txType?: string;
    rawCode?: string;
  }
}

declare module '@nimbus/shared/src/categories' {
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

  export const CATEGORY_GROUPS: CategoryGroup[];
  export const CATEGORIES: Category[];
  export function getGroups(): CategoryGroup[];
  export function getCategories(): Category[];
  export function getCategoryById(id: string): Category | undefined;
}


