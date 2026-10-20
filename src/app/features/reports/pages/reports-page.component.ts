import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Ticket } from '../../../core/models';
import { LocalHistoryService, StoredTicket } from '../../../core/state/local-history.service';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  compactMoney, dateKey, displayPlate, durationText, hhmm, minutesBetween, money, parseDateKey, paymentMethodMeta, shortDate, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

type Filters = { from: string; to: string; type: string };

@Component({
  selector: 'reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-page.component.html'
})
export class ReportsPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private history = inject(LocalHistoryService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);

  form: Filters = this.defaultFilters();
  applied = signal<Filters>(this.defaultFilters());
  tickets = signal<StoredTicket[]>([]);

  inRange = computed(() => {
    const { from, to, type } = this.applied();
    return this.tickets().filter(ticket => {
      const day = dateKey(ticket.checkedOutAt || ticket.checkedInAt);
      return day >= from && day <= to && (!type || ticket.vehicleType === type);
    });
  });
  closed = computed(() => this.inRange().filter(ticket => ticket.status !== 'ACTIVE'));
  paid = computed(() => this.closed().filter(ticket => !ticket.monthlySubscription));
  ticketRevenue = computed(() => this.paid().reduce((sum, ticket) => sum + Number(ticket.amountDue || 0), 0));
  monthlyInRange = computed(() => {
    const { from, to, type } = this.applied();
    return this.context.subscriptions().filter(item => {
      const day = dateKey(item.paidAt || item.startsAt);
      return day >= from && day <= to && (!type || item.vehicleType === type);
    });
  });
  monthlyRevenue = computed(() => this.monthlyInRange().reduce((sum, item) => sum + Number(item.amount || 0), 0));
  totalRevenue = computed(() => this.ticketRevenue() + this.monthlyRevenue());
  days = computed(() => {
    const { from, to } = this.applied();
    return Math.max(1, Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000) + 1);
  });
  averageTicket = computed(() => this.paid().length ? Math.round(this.ticketRevenue() / this.paid().length) : 0);
  activeMonthly = computed(() => this.context.activeSubscriptions());
  activeMonthlyAmount = computed(() => this.activeMonthly().reduce((sum, item) => sum + Number(item.amount || 0), 0));

  daily = computed(() => {
    const { from, to } = this.applied();
    const start = parseDateKey(from);
    const end = parseDateKey(to);
    const first = new Date(Math.max(start.getTime(), end.getTime() - 30 * 86_400_000));
    const buckets: { key: string; label: string; value: number }[] = [];
    for (const day = new Date(first); day <= end; day.setDate(day.getDate() + 1)) {
      buckets.push({ key: dateKey(day), label: String(day.getDate()), value: 0 });
    }
    this.paid().forEach(ticket => {
      const bucket = buckets.find(item => item.key === dateKey(ticket.checkedOutAt || ticket.checkedInAt));
      if (bucket) bucket.value += Number(ticket.amountDue || 0);
    });
    this.monthlyInRange().forEach(item => {
      const bucket = buckets.find(row => row.key === dateKey(item.paidAt || item.startsAt));
      if (bucket) bucket.value += Number(item.amount || 0);
    });
    const max = Math.max(1, ...buckets.map(item => item.value));
    return buckets.map(item => ({ ...item, pct: Math.round(item.value / max * 100) }));
  });

  byType = computed(() => {
    const rows = [
      { type: 'CAR', label: '🚗 Carros', color: 'var(--blue)', fill: 'red' },
      { type: 'MOTORCYCLE', label: '🏍 Motos', color: 'var(--purple)', fill: 'green' },
      { type: 'HEAVY', label: '🚚 Pesados', color: 'var(--amber)', fill: 'blue' },
      { type: 'BICYCLE', label: '🚲 Bicicletas', color: 'var(--teal)', fill: 'amber' }
    ];
    const total = Math.max(1, this.ticketRevenue());
    return rows
      .map(row => {
        const value = this.paid().filter(ticket => ticket.vehicleType === row.type).reduce((sum, ticket) => sum + Number(ticket.amountDue || 0), 0);
        return { ...row, value, pct: Math.round(value / total * 100) };
      })
      .filter(row => row.type !== 'BICYCLE' || row.value > 0);
  });

  detail = computed(() => [...this.closed()]
    .sort((a, b) => (b.checkedOutAt || b.checkedInAt).localeCompare(a.checkedOutAt || a.checkedInAt))
    .slice(0, 200));

  constructor() {
    this.load();
  }

  load() {
    const headers = tenantHeaders(this.tenantId);
    const refresh = () => this.tickets.set(this.history.tickets(this.tenantId));
    refresh();
    this.http.get<Ticket[]>(`${API.operation}/tickets/recent`, headers).subscribe({
      next: tickets => { this.history.mergeTickets(this.tenantId, tickets); refresh(); },
      error: () => this.toast.err('No se pudieron consultar los tickets recientes')
    });
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, headers).subscribe({
      next: tickets => { this.history.mergeTickets(this.tenantId, tickets); refresh(); },
      error: () => undefined
    });
  }

  generate() {
    if (this.form.from > this.form.to) { this.toast.err('La fecha inicio debe ser anterior a la fecha fin'); return; }
    this.applied.set({ ...this.form });
    this.toast.ok(`${this.inRange().length} registros encontrados`, '↗');
  }

  print() { window.print(); }

  rangeLabel() {
    const { from, to } = this.applied();
    return `${shortDate(from)} – ${shortDate(to)}, ${parseDateKey(to).getFullYear()}`;
  }

  monthLabel() {
    const date = parseDateKey(this.applied().to);
    const month = date.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
  }

  method(ticket: StoredTicket) {
    if (ticket.monthlySubscription) return { label: 'Mensual', cls: 'amber' };
    const { label, cls } = paymentMethodMeta(ticket.paymentMethod);
    return { label, cls };
  }

  duration(ticket: Ticket) { return durationText(minutesBetween(ticket.checkedInAt, ticket.checkedOutAt || new Date())); }

  meta = vehicleMeta;
  money = money;
  compact = compactMoney;
  hhmm = hhmm;
  shortDate = shortDate;
  plate = displayPlate;
  dateKey = dateKey;

  private defaultFilters(): Filters {
    const today = new Date();
    return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateKey(today), type: '' };
  }
}
