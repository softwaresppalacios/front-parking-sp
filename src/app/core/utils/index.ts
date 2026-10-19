import { HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { PricingRule, Schedule } from '../models';

export function tenantIdFromRoute(route: ActivatedRoute): string {
  let current: ActivatedRoute | null = route;
  while (current) {
    const id = current.snapshot.paramMap.get('tenantUuid');
    if (id) return id;
    current = current.parent;
  }
  return '';
}

export function tenantHeaders(tenantId: string) {
  return { headers: new HttpHeaders({ 'X-Tenant-Id': tenantId }) };
}

/** Formato de pesos del prototipo: $87.000 */
export function money(value: number | string | null | undefined) {
  return '$' + Math.round(Number(value) || 0).toLocaleString('es-CO');
}

/** Formato compacto para tarjetas: $1.24M, $240K, $1.815 */
export function compactMoney(value: number) {
  const amount = Math.round(Number(value) || 0);
  if (amount >= 1_000_000) return '$' + trimDecimals(amount / 1_000_000) + 'M';
  if (amount >= 100_000) return '$' + Math.round(amount / 1000) + 'K';
  return money(amount);
}

function trimDecimals(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export type VehicleMeta = { emoji: string; cls: string; short: string; label: string };

const VEHICLES: Record<string, VehicleMeta> = {
  CAR: { emoji: '🚗', cls: 'carro', short: 'Carro', label: 'Carro Normal' },
  MOTORCYCLE: { emoji: '🏍', cls: 'moto', short: 'Moto', label: 'Moto' },
  HEAVY: { emoji: '🚚', cls: 'pesado', short: 'Pesado', label: 'Carga Pesada' },
  BICYCLE: { emoji: '🚲', cls: 'bici', short: 'Bici', label: 'Bicicleta' }
};

export const VEHICLE_TYPES = ['CAR', 'HEAVY', 'MOTORCYCLE', 'BICYCLE'];

export function vehicleMeta(type: string): VehicleMeta {
  return VEHICLES[type] || VEHICLES['CAR'];
}

export function vehicleLabel(type: string) {
  return vehicleMeta(type).label;
}

export function usesCompactSpace(type: string) {
  return type === 'MOTORCYCLE' || type === 'BICYCLE';
}

export function dayLabel(day: string) {
  return ({
    MONDAY: 'Lunes',
    TUESDAY: 'Martes',
    WEDNESDAY: 'Miércoles',
    THURSDAY: 'Jueves',
    FRIDAY: 'Viernes',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo'
  } as Record<string, string>)[day] || day;
}

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function shortDay(date: Date) {
  return SHORT_DAYS[date.getDay()];
}

export function dayKey(date: Date) {
  return DAY_KEYS[date.getDay()];
}

export function sortSchedules(schedules: Schedule[]) {
  const order = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  return [...schedules].sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek));
}

export function normalizeAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatPlate(value: string, max = 8) {
  return (value || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, max);
}

export function cleanPlate(value: string) {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Muestra la placa como en el prototipo: ABC123 -> ABC 123 */
export function displayPlate(plate: string | null | undefined) {
  const clean = cleanPlate(plate || '');
  return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean;
}

/** Fecha local en formato YYYY-MM-DD. */
export function dateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function hhmm(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function shortDate(value: string | Date) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateKey(value) : new Date(value);
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function minutesBetween(from: string | Date, to: string | Date = new Date()) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.max(0, Math.floor((end - start) / 60000));
}

export function durationText(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${hours}h`;
}

export function daysUntil(dateKeyValue: string) {
  const today = parseDateKey(dateKey(new Date()));
  const target = parseDateKey(dateKeyValue);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function initials(name: string) {
  const words = (name || 'SP').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || words[0]?.[1] || '')).toUpperCase();
}

/** Replica en el navegador el calculo del pricing-service para mostrar valores estimados. */
export function estimateAmount(rule: PricingRule | undefined, minutes: number): number {
  if (!rule) return 0;
  const billable = Math.max(1, minutes);
  if (rule.pricingModel === 'FLAT') return Number(rule.flatAmount) || 0;
  const day = Number(rule.dayAmount) || 0;
  if (billable >= 24 * 60 && day > 0) {
    const days = Math.floor(billable / (24 * 60));
    const remaining = billable % (24 * 60);
    return day * days + estimateAmount(rule, remaining === 0 ? 1 : remaining);
  }
  const hourly = Number(rule.hourlyAmount) || 0;
  const additional = Number(rule.additionalHourAmount ?? rule.hourlyAmount) || 0;
  const fraction = Number(rule.fractionAmount) || 0;
  const fractionMinutes = Math.max(1, Number(rule.fractionMinutes) || 30);
  const increaseAfter = Number(rule.rateIncreaseAfterHours) || 0;
  const increase = Number(rule.rateIncreaseAmount) || 0;
  const withIncrease = (hourNumber: number, base: number) => increaseAfter > 0 && hourNumber > increaseAfter ? base + increase : base;
  const capped = (total: number) => rule.applyDailyCap && day > 0 ? Math.min(total, day) : total;

  const fullHours = Math.floor(billable / 60);
  const remainingMinutes = billable % 60;
  if (fullHours === 0) return capped(hourly);
  let total = withIncrease(1, hourly);
  for (let hour = 2; hour <= fullHours; hour++) total += withIncrease(hour, additional);
  if (remainingMinutes > 0) total += fraction * Math.ceil(remainingMinutes / fractionMinutes);
  return capped(total);
}

/** Desglose de la tarifa para mostrar en la salida. */
export function amountBreakdown(rule: PricingRule | undefined, minutes: number) {
  if (!rule || rule.pricingModel === 'FLAT') return { base: Number(rule?.flatAmount) || 0, extra: 0 };
  const total = estimateAmount(rule, minutes);
  const base = Number(rule.hourlyAmount) || 0;
  return { base, extra: Math.max(0, total - base) };
}

export function whatsappUrl(phone: string | null | undefined, text: string) {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `57${digits}`;
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Descarga un CSV que Excel abre directamente (separador ; y BOM UTF-8). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const content = '﻿' + rows.map(row => row.map(escape).join(';')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento no disponible (modo privado o cuota llena): se ignora.
  }
}

export function sessionUserName() {
  return readStorage<{ user?: { fullName?: string } }>('sp_session', {}).user?.fullName || 'Administrador';
}
