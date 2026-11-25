import { readFileSync } from 'node:fs';
import { loadCatalogs } from '../core/load-catalogs.js';

export const cat = loadCatalogs().hsr;

export function loadOrder(name) {
  return JSON.parse(readFileSync(new URL(`./orders/${name}.json`, import.meta.url), 'utf8'));
}

/** Минимальный заказ для проверки правил. */
export function order(W, H, options = {}) {
  return {
    productType: 'hsr', id: 'DSO-1-1',
    opening: { width: W, height: H, quantity: 1 },
    options: { pvc: 'blue', driveSide: 'L', controlSide: 'L', ...options },
  };
}

export const line = (spec, sku) => spec.lines.find((l) => l.sku === sku);
export const codes = (calc) => [...calc.errors, ...calc.warnings].map((m) => m.code);
