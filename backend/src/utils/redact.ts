// Redact PII such as IBAN, BIC, names in free-form text

const IBAN_RE = /\b([A-Z]{2}\d{2})([A-Z0-9]{4})([A-Z0-9]{4})([A-Z0-9]{0,14})\b/g; // coarse
const BIC_RE = /\b([A-Z]{4})([A-Z]{2})([A-Z0-9]{2})([A-Z0-9]{0,3})\b/g; // coarse
const NAME_RE = /\b([A-ZÄÖÜ][a-zäöüß]{2,})(\s+[A-ZÄÖÜ][a-zäöüß]{1,})+\b/g; // Full names

export function redactPII(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(IBAN_RE, (_m, a) => `${a}••••••••••••••••`);
  out = out.replace(BIC_RE, (_m, a, b) => `${a}${b}•••`);
  out = out.replace(NAME_RE, (m) => {
    const parts = m.split(/\s+/);
    return parts.map(p => p[0] + '…').join(' ');
  });
  return out;
}

export function safeError(err: any): string {
  const msg = (err?.message || String(err || 'Unknown error')) as string;
  return redactPII(msg);
}


