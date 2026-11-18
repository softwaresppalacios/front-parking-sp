import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Ticket } from '../../../core/models';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { TicketPrinterService } from '../../../core/ui/ticket-printer.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  VEHICLE_TYPES, apiErrorMessage, cleanPlate, dateKey, displayPlate, downloadCsv, durationText, helmetLockersOf, hhmm,
  minutesBetween, money, paymentMethodMeta, shortDate, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

type Range = { from: string; to: string };
type Status = '' | 'INSIDE' | 'OUT';
type Modality = '' | 'HOURLY' | 'MONTHLY';

const MAX_ROWS = 500;
const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Historial de tickets: busqueda, detalle y estadisticas de entradas (horas pico, estadias). */
@Component({
  selector: 'ticket-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-history-page.component.html'
})
export class TicketHistoryPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private printer = inject(TicketPrinterService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);
  vehicleTypes = VEHICLE_TYPES;

  range: Range = this.defaultRange();
  loadedRange = signal<Range>(this.defaultRange());
  tickets = signal<Ticket[]>([]);
  loading = signal(false);
  error = signal('');
  now = signal(new Date());
  selected = signal<Ticket | null>(null);

  // Filtros sobre lo ya cargado: responden al instante.
  plate = signal('');
  status = signal<Status>('');
  type = signal('');
  modality = signal<Modality>('');

  filtered = computed(() => {
    const plate = cleanPlate(this.plate());
    return this.tickets().filter(ticket =>
      (!plate || ticket.plate.includes(plate))
      && (!this.status() || (this.status() === 'INSIDE') === (ticket.status === 'ACTIVE'))
      && (!this.type() || ticket.vehicleType === this.type())
      && (!this.modality() || (this.modality() === 'MONTHLY') === ticket.monthlySubscription));
  });
  rows = computed(() => this.filtered().slice(0, MAX_ROWS));
  truncated = computed(() => this.filtered().length > MAX_ROWS);

  stats = computed(() => {
    const tickets = this.filtered();
    const closed = tickets.filter(ticket => ticket.checkedOutAt);
    const charged = closed.filter(ticket => !ticket.monthlySubscription);
    const stays = closed.map(ticket => minutesBetween(ticket.checkedInAt, ticket.checkedOutAt!));
    return {
      entries: tickets.length,
      inside: tickets.filter(ticket => ticket.status === 'ACTIVE').length,
      exits: closed.length,
      monthly: tickets.filter(ticket => ticket.monthlySubscription).length,
      revenue: charged.reduce((sum, ticket) => sum + Number(ticket.amountDue || 0), 0),
      averageStay: stays.length ? Math.round(stays.reduce((sum, value) => sum + value, 0) / stays.length) : 0,
      longestStay: stays.length ? Math.max(...stays) : 0
    };
  });

  /** Entradas por hora del dia (0-23): muestra las horas pico. */
  byHour = computed(() => {
    const counts = Array.from({ length: 24 }, () => 0);
    this.filtered().forEach(ticket => counts[new Date(ticket.checkedInAt).getHours()]++);
    const max = Math.max(1, ...counts);
    return counts.map((value, hour) => ({ label: String(hour), value, pct: Math.round(value / max * 100) }));
  });
  peakHour = computed(() => {
    const top = [...this.byHour()].sort((a, b) => b.value - a.value)[0];
    return top && top.value ? `${top.label}:00 – ${Number(top.label) + 1}:00` : '—';
  });
  /** Entradas por dia de la semana (lunes a domingo). */
  byWeekDay = computed(() => {
    const counts = Array.from({ length: 7 }, () => 0);
    this.filtered().forEach(ticket => counts[(new Date(ticket.checkedInAt).getDay() + 6) % 7]++);
    const max = Math.max(1, ...counts);
    return counts.map((value, index) => ({ label: WEEK_DAYS[index], value, pct: Math.round(value / max * 100) }));
  });

  constructor() {
    this.load(false);
    // El tiempo de los vehiculos que siguen adentro avanza en pantalla.
    const timer = window.setInterval(() => this.now.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  load(announce = true) {
    if (this.range.from > this.range.to) { this.toast.err('La fecha inicio debe ser anterior a la fecha fin'); return; }
    this.loading.set(true);
    this.error.set('');
    const params = new HttpParams().set('from', this.range.from).set('to', this.range.to);
    this.http.get<Ticket[]>(`${API.operation}/tickets/history`, { ...tenantHeaders(this.tenantId), params }).subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.loadedRange.set({ ...this.range });
        this.selected.set(null);
        this.now.set(new Date());
        this.loading.set(false);
        if (announce) this.toast.ok(`${tickets.length} tickets en el período`, '⌕');
      },
      error: err => {
        const message = apiErrorMessage(err, 'No se pudo cargar el historial de tickets');
        this.error.set(message);
        this.toast.err(message);
        this.loading.set(false);
      }
    });
  }

  clearFilters() {
    this.plate.set('');
    this.status.set('');
    this.type.set('');
    this.modality.set('');
  }

  select(ticket: Ticket) {
    this.selected.set(this.selected()?.uuid === ticket.uuid ? null : ticket);
  }

  reprint(ticket: Ticket) {
    this.printer.print(ticket, { reprint: true });
  }

  goToExit(ticket: Ticket) {
    this.router.navigate(['../salida'], { relativeTo: this.route, queryParams: { placa: ticket.plate } });
  }

  exportCsv() {
    const tickets = this.filtered();
    if (!tickets.length) { this.toast.err('No hay tickets para exportar'); return; }
    const range = this.loadedRange();
    downloadCsv(`tickets_${range.from}_${range.to}.csv`, [
      ['Ticket', 'Placa', 'Tipo', 'Modalidad', 'Fecha entrada', 'Hora entrada', 'Fecha salida', 'Hora salida', 'Tiempo', 'Lugar', 'Llaves', 'Cascos', 'Conductor', 'Cédula', 'Valor', 'Pago', 'Estado'],
      ...tickets.map(ticket => [
        ticket.code || '', displayPlate(ticket.plate), vehicleMeta(ticket.vehicleType).label,
        ticket.monthlySubscription ? 'Mensualidad' : 'Por tiempo',
        dateKey(ticket.checkedInAt), hhmm(ticket.checkedInAt),
        ticket.checkedOutAt ? dateKey(ticket.checkedOutAt) : '', ticket.checkedOutAt ? hhmm(ticket.checkedOutAt) : '',
        this.stay(ticket), ticket.spaceCode || '', ticket.keySlotCode || '', helmetLockersOf(ticket).join(' '),
        ticket.driverName || '', ticket.driverDocument || '',
        ticket.checkedOutAt && !ticket.monthlySubscription ? Number(ticket.amountDue || 0) : '',
        ticket.paymentMethod ? paymentMethodMeta(ticket.paymentMethod).label : '',
        ticket.status === 'ACTIVE' ? 'Adentro' : 'Salió'
      ])
    ]);
    this.toast.ok('Historial exportado a Excel (CSV)', '📊');
  }

  stay(ticket: Ticket) {
    return durationText(minutesBetween(ticket.checkedInAt, ticket.checkedOutAt || this.now()));
  }

  value(ticket: Ticket) {
    if (ticket.monthlySubscription) return 'Mensual';
    if (!ticket.checkedOutAt) return '—';
    return money(ticket.amountDue || 0);
  }

  resources(ticket: Ticket) {
    return [ticket.keySlotCode, ...helmetLockersOf(ticket)].filter(Boolean).join(', ') || '—';
  }

  rangeLabel() {
    const range = this.loadedRange();
    return range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`;
  }

  meta = vehicleMeta;
  money = money;
  hhmm = hhmm;
  shortDate = shortDate;
  dateKey = dateKey;
  plateText = displayPlate;
  durationText = durationText;
  methodMeta = paymentMethodMeta;
  helmets = helmetLockersOf;

  private defaultRange(): Range {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: dateKey(weekAgo), to: dateKey(today) };
  }
}
