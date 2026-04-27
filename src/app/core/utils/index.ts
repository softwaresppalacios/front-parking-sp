import { HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Schedule } from '../models';

export function tenantIdFromRoute(route: ActivatedRoute): string {
  return route.parent?.snapshot.paramMap.get('tenantUuid') ?? route.snapshot.paramMap.get('tenantUuid') ?? '';
}

export function tenantHeaders(tenantId: string) {
  return { headers: new HttpHeaders({ 'X-Tenant-Id': tenantId }) };
}

export function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0
  }).format(value);
}

export function vehicleLabel(type: string) {
  return type === 'MOTORCYCLE' ? 'Moto' : type === 'HEAVY' ? 'Carga pesada' : type === 'BICYCLE' ? 'Bicicleta' : 'Carro';
}

export function dayLabel(day: string) {
  return ({
    MONDAY: 'Lunes',
    TUESDAY: 'Martes',
    WEDNESDAY: 'Miercoles',
    THURSDAY: 'Jueves',
    FRIDAY: 'Viernes',
    SATURDAY: 'Sabado',
    SUNDAY: 'Domingo'
  } as Record<string, string>)[day] || day;
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
