import { HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { GATEWAY_URL } from '../api/api.config';
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

const MINUTES_PER_DAY = 24 * 60;

export type ChargeEstimate = { amount: number; days: number; firstHourCharged: boolean; additionalMinutes: number; additionalAmount: number };

/**
 * Replica en el navegador el cobro del pricing-service: la primera hora (o fraccion) con su valor,
 * despues cada minuto proporcional al valor de la hora adicional (redondeado al peso),
 * y bloques de 24 h con el valor dia. El valor que se cobra siempre lo calcula el servidor.
 */
export function estimateCharge(rule: PricingRule | undefined, minutes: number): ChargeEstimate {
  const none = { days: 0, firstHourCharged: false, additionalMinutes: 0, additionalAmount: 0 };
  if (!rule) return { amount: 0, ...none };
  if (rule.pricingModel === 'FLAT') return { amount: Number(rule.flatAmount) || 0, ...none };
  const billable = Math.max(1, minutes);
  const day = Number(rule.dayAmount) || 0;
  let days = 0;
  let rest = billable;
  if (billable >= MINUTES_PER_DAY && day > 0) {
    days = Math.floor(billable / MINUTES_PER_DAY);
    rest = billable % MINUTES_PER_DAY;
    if (rest === 0) return { amount: day * days, ...none, days };
  }
  const hourly = Number(rule.hourlyAmount) || 0;
  const additional = Number(rule.additionalHourAmount ?? rule.hourlyAmount) || 0;
  const increaseAfter = Number(rule.rateIncreaseAfterHours) || 0;
  const increase = Number(rule.rateIncreaseAmount) || 0;
  const withIncrease = (hourNumber: number, base: number) => increaseAfter > 0 && hourNumber > increaseAfter ? base + increase : base;
  const additionalMinutes = Math.max(0, rest - 60);
  const fullHours = Math.floor(additionalMinutes / 60);
  const looseMinutes = additionalMinutes % 60;
  let additionalAmount = 0;
  for (let hour = 2; hour <= fullHours + 1; hour++) additionalAmount += withIncrease(hour, additional);
  if (looseMinutes) additionalAmount += withIncrease(fullHours + 2, additional) * looseMinutes / 60;
  additionalAmount = Math.round(additionalAmount);
  let hours = withIncrease(1, hourly) + additionalAmount;
  if (rule.applyDailyCap && day > 0) hours = Math.min(hours, day);
  return { amount: day * days + hours, days, firstHourCharged: true, additionalMinutes, additionalAmount };
}

export function estimateAmount(rule: PricingRule | undefined, minutes: number): number {
  return estimateCharge(rule, minutes).amount;
}

/** Etiqueta del metodo de pago. DIGITAL es el nombre anterior de ONLINE. */
export function paymentMethodMeta(method: string | null | undefined) {
  if (method === 'ONLINE' || method === 'DIGITAL') return { label: 'En línea', icon: '🌐', cls: 'blue' };
  if (method === 'CASH') return { label: 'Efectivo', icon: '💵', cls: 'green' };
  return { label: '—', icon: '', cls: '' };
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

/**
 * Mensaje legible para un error HTTP. Sin respuesta (status 0) es el gateway el que esta apagado;
 * si un servicio detras del gateway esta apagado, el gateway responde 503 diciendo cual es.
 */
export function apiErrorMessage(err: { status?: number; url?: string | null; error?: { message?: string } } | null | undefined, fallback: string) {
  if (err?.status === 0) {
    return `El servidor (API Gateway en ${GATEWAY_URL}) no responde. Verifica que esté encendido.`;
  }
  return err?.error?.message || fallback;
}

/** Casilleros de casco de un ticket (0, 1 o 2), compatible con tickets que solo traen helmetLockerCode. */
export function helmetLockersOf(ticket: { helmetLockerCode?: string | null; helmetLockerCodes?: string[] | null }) {
  if (ticket.helmetLockerCodes?.length) return ticket.helmetLockerCodes;
  return ticket.helmetLockerCode ? [ticket.helmetLockerCode] : [];
}
