import type { BankProfile } from '../types';
import { comdirectProfile } from './comdirect';
import { sparkasseProfile } from './sparkasse';
import { dkbProfile } from './dkb';
import { ingProfile } from './ing';
import { genericDeProfile } from './generic_de';

export const BANK_PROFILES: BankProfile[] = [
  comdirectProfile,
  sparkasseProfile,
  dkbProfile,
  ingProfile,
  genericDeProfile,
];


