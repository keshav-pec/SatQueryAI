export const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const nf2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ha = (v: number, digits = 0) => `${digits ? nf1.format(v) : nf0.format(v)} ha`;
export const km2 = (v: number) => `${nf2.format(v)} km²`;
export const pct = (v: number, digits = 1) => `${v.toFixed(digits)} %`;
export const signed = (v: number, digits = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}`;

export function latlon([lon, lat]: number[], digits = 4): string {
  return `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(digits)}° ${lon >= 0 ? "E" : "W"}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function ms(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`;
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
