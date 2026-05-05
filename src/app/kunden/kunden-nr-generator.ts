export const KUNDEN_NR_PATTERN = /^K-(\d{4,})$/;

export function isValidKundenNr(nr: string): boolean {
  return KUNDEN_NR_PATTERN.test(nr);
}

export function formatKundenNr(n: number): string {
  return `K-${String(n).padStart(4, "0")}`;
}

export function nextKundenNr(existing: string[]): string {
  let max = 0;
  for (const nr of existing) {
    const match = KUNDEN_NR_PATTERN.exec(nr);
    if (!match) continue;
    const n = parseInt(match[1], 10);
    if (n > max) max = n;
  }
  return formatKundenNr(max + 1);
}
