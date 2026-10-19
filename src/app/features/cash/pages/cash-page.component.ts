import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { CashClosure, CashSummary, Ticket } from '../../../core/models';
import { LocalHistoryService } from '../../../core/state/local-history.service';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import { dateKey, hhmm, money, parseDateKey, sessionUserName, shortDate, shortDay, tenantHeaders, tenantIdFromRoute, vehicleMeta } from '../../../core/utils';

@Component({
  selector: 'cash-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-page.component.html'
})
export class CashPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private history = inject(LocalHistoryService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);

  summary = signal<CashSummary | null>(null);
  tickets = signal<Ticket[]>([]);
  closures = signal<CashClosure[]>([]);
  modalOpen = signal(false);
  notes = '';

  today = dateKey(new Date());
  rows = computed(() => this.history.movementRows(this.summary()?.recentMovements || [], this.tickets(), this.context.subscriptions()));
  vehicleRows = computed(() => this.rows().filter(row => !row.monthly));
  monthlyTotal = computed(() => this.rows().filter(row => row.monthly).reduce((sum, row) => sum + row.amount, 0));
  total = computed(() => Number(this.summary()?.todayRevenue) || 0);
  average = computed(() => this.vehicleRows().length ? Math.round((this.total() - this.monthlyTotal()) / this.vehicleRows().length) : 0);
  todayClosure = computed(() => this.closures().find(item => item.date === this.today) || null);
  previousClosures = computed(() => this.closures().filter(item => item.date !== this.today).slice(0, 5));
  openingTime = computed(() => {
    const open = this.context.todaySchedule()?.openTime;
    if (open) return open.slice(0, 5);
    const first = this.rows()[0];
    return first ? hhmm(first.paidAt) : '—';
  });

  hourly = computed(() => {
    const schedule = this.context.todaySchedule();
    const start = schedule?.openTime ? Number(schedule.openTime.slice(0, 2)) : 6;
    const end = schedule?.closeTime ? Number(schedule.closeTime.slice(0, 2)) : 18;
    const buckets = new Map<number, number>();
    for (let hour = start; hour <= Math.max(start, end); hour++) buckets.set(hour, 0);
    this.rows().forEach(row => {
      const hour = new Date(row.paidAt).getHours();
      buckets.set(hour, (buckets.get(hour) || 0) + row.amount);
    });
    const entries = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const max = Math.max(1, ...entries.map(([, value]) => value));
    return entries.map(([hour, value]) => ({ label: String(hour % 12 || 12), value, pct: Math.round(value / max * 100) }));
  });

  constructor() {
    this.load();
  }

  load() {
    const headers = tenantHeaders(this.tenantId);
    this.http.get<CashSummary>(`${API.payment}/cash-sessions/current`, headers).subscribe({
      next: summary => this.summary.set(summary),
      error: () => { this.summary.set(null); this.toast.err('No se pudo cargar la caja del día'); }
    });
    this.http.get<Ticket[]>(`${API.operation}/tickets/recent`, headers).subscribe({
      next: recent => {
        this.history.mergeTickets(this.tenantId, recent);
        this.tickets.set(this.history.tickets(this.tenantId));
      },
      error: () => this.tickets.set(this.history.tickets(this.tenantId))
    });
    this.closures.set(this.history.closures(this.tenantId));
  }

  openClose() {
    this.notes = this.todayClosure()?.notes || '';
    this.modalOpen.set(true);
  }

  confirmClose() {
    const summary = this.summary();
    const closure: CashClosure = {
      id: `${this.today}-${Date.now()}`,
      date: this.today,
      openedAt: this.openingTime(),
      closedAt: hhmm(new Date()),
      responsible: sessionUserName(),
      vehicles: this.vehicleRows().length,
      cash: Number(summary?.cashRevenue) || 0,
      digital: Number(summary?.digitalRevenue) || 0,
      monthly: this.monthlyTotal(),
      total: this.total(),
      notes: this.notes.trim() || 'Sin novedades',
      movements: this.rows()
    };
    this.history.saveClosure(this.tenantId, closure);
    this.closures.set(this.history.closures(this.tenantId));
    this.modalOpen.set(false);
    this.toast.ok(`Caja cerrada. Total del día: ${money(closure.total)}`, '◈');
  }

  closureLabel(item: CashClosure) {
    return `${shortDay(parseDateKey(item.date))} ${shortDate(item.date)}`;
  }

  todayLabel() {
    return `${shortDay(new Date())} ${shortDate(this.today)}`;
  }

  meta = vehicleMeta;
  money = money;
}
