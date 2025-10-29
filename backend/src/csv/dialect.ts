export type Delimiter = ',' | ';' | '\t';

export class CSVDialectDetector {
  detectDelimiter(text: string): Delimiter {
    const first = (text.split(/\r?\n/).find(l => l.trim().length) || '');
    const counts = {
      ';': (first.match(/;/g) || []).length,
      ',': (first.match(/,/g) || []).length,
      '\t': (first.match(/\t/g) || []).length,
    } as Record<Delimiter, number>;
    const best = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] as Delimiter | undefined;
    return best || ';';
  }

  detectDecimalSeparator(samples: string[]): ',' | '.' {
    let comma = 0, dot = 0;
    for (const s of samples) {
      if (!s) continue;
      if (/,\d{1,2}$/.test(s)) comma++;
      if (/\.\d{1,2}$/.test(s)) dot++;
    }
    return comma >= dot ? ',' : '.';
  }

  detectDateFormat(samples: string[]): 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' {
    let de = 0, iso = 0, us = 0;
    for (const s of samples) {
      if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(s)) de++;
      else if (/^\d{4}-\d{2}-\d{2}/.test(s)) iso++;
      else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) us++;
    }
    if (de >= iso && de >= us) return 'DD.MM.YYYY';
    if (iso >= us) return 'YYYY-MM-DD';
    return 'MM/DD/YYYY';
  }
}


