import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { CashSummary, DashboardSummary, Resource, ResourceBoard, Ticket } from '../../../core/models';
import { LocalHistoryService } from '../../../core/state/local-history.service';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import {
  dateKey, displayPlate, durationText, estimateAmount, hhmm, minutesBetween, money, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

type SlotView = { code: string; state: 'libre' | 'ocupado' | 'reservado'; icon: string; plate: string };

@Component({
  selector: 'dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.component.html'
})
export class DashboardPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private history = inject(LocalHistoryService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);

  summary = signal<DashboardSummary | null>(null);
  activeTickets = signal<Ticket[]>([]);
  recentTickets = signal<Ticket[]>([]);
  cash = signal<CashSummary | null>(null);
  board = signal<ResourceBoard | null>(null);
  now = signal(new Date());

  private activeByPlate = computed(() => new Map(this.activeTickets().map(ticket => [ticket.plate, ticket])));

  carSlots = computed(() => this.slots(this.board()?.carSpaces || [], '🚗'));
  motoSlots = computed(() => this.slots(this.board()?.motorcycleSpaces || [], '🏍'));
  totalSpaces = computed(() => (this.board()?.carSpaces.length || 0) + (this.board()?.motorcycleSpaces.length || 0));
  vehiclesInside = computed(() => this.summary()?.activeTickets ?? this.activeTickets().length);
  occupancyPct = computed(() => this.totalSpaces() ? Math.min(100, Math.round(this.vehiclesInside() / this.totalSpaces() * 100)) : 0);

  todayTickets = computed(() => {
    const today = dateKey(this.now());
    const known = new Map(this.history.tickets(this.tenantId).map(ticket => [ticket.uuid, ticket as Ticket]));
    [...this.recentTickets(), ...this.activeTickets()].forEach(ticket => known.set(ticket.uuid, ticket));
    return [...known.values()].filter(ticket => dateKey(ticket.checkedInAt) === today || (ticket.checkedOutAt && dateKey(ticket.checkedOutAt) === today));
  });
  entriesToday = computed(() => this.todayTickets().filter(ticket => dateKey(ticket.checkedInAt) === dateKey(this.now())));
  exitsToday = computed(() => this.todayTickets().filter(ticket => ticket.checkedOutAt && dateKey(ticket.checkedOutAt) === dateKey(this.now())));
  movementsToday = computed(() => this.entriesToday().length + this.exitsToday().length);

  distribution = computed(() => {
    const entries = this.entriesToday();
    const total = Math.max(1, entries.length);
    const rows = [
      { type: 'CAR', label: 'Carros', color: 'var(--blue)', fill: 'red' },
      { type: 'MOTORCYCLE', label: 'Motos', color: 'var(--purple)', fill: 'green' },
      { type: 'HEAVY', label: 'Carga pesada', color: 'var(--amber)', fill: 'blue' },
      { type: 'BICYCLE', label: 'Bicicletas', color: 'var(--teal)', fill: 'amber' }
    ].map(row => {
      const count = entries.filter(ticket => ticket.vehicleType === row.type).length;
      return { ...row, count, pct: Math.round(count / total * 100) };
    });
    return rows.filter(row => row.type !== 'BICYCLE' || row.count > 0);
  });

  revenueVsYesterday = computed(() => {
    const yesterday = new Date(this.now());
    yesterday.setDate(yesterday.getDate() - 1);
    const closure = this.history.closureFor(this.tenantId, dateKey(yesterday));
    const today = Number(this.cash()?.todayRevenue) || 0;
    if (!closure?.total) return null;
    const pct = Math.round((today - closure.total) / closure.total * 100);
    return { text: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs ayer` };
  });

  constructor() {
    this.reload();
    const tick = window.setInterval(() => this.now.set(new Date()), 30_000);
    const refresh = window.setInterval(() => this.reload(), 60_000);
    inject(DestroyRef).onDestroy(() => { window.clearInterval(tick); window.clearInterval(refresh); });
  }

  reload() {
    const headers = tenantHeaders(this.tenantId);
    this.http.get<DashboardSummary>(`${API.reporting}/dashboards/current`, headers).subscribe({ next: v => this.summary.set(v), error: () => this.summary.set(null) });
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, headers).subscribe({ next: v => this.activeTickets.set(v), error: () => this.activeTickets.set([]) });
    this.http.get<Ticket[]>(`${API.operation}/tickets/recent`, headers).subscribe({
      next: v => { this.recentTickets.set(v); this.history.mergeTickets(this.tenantId, v); },
      error: () => this.recentTickets.set([])
    });
    this.http.get<CashSummary>(`${API.payment}/cash-sessions/current`, headers).subscribe({ next: v => this.cash.set(v), error: () => this.cash.set(null) });
    this.http.get<ResourceBoard>(`${API.operation}/resources/board`, headers).subscribe({ next: v => this.board.set(v), error: () => this.board.set(null) });
    this.now.set(new Date());
  }

  openSlot(slot: SlotView) {
    if (slot.state === 'libre') {
      this.router.navigate(['../entrada'], { relativeTo: this.route, queryParams: { slot: slot.code } });
    } else if (slot.plate) {
      this.router.navigate(['../salida'], { relativeTo: this.route, queryParams: { placa: slot.plate.replace(' ', '') } });
    }
  }

  slotNumber(item: Resource) {
    const digits = item.code.replace(/\D/g, '');
    return digits ? digits.padStart(2, '0') : item.code;
  }

  status(ticket: Ticket) {
    if (ticket.monthlySubscription && ticket.status === 'ACTIVE') return 'mensual';
    return ticket.status === 'ACTIVE' ? 'activo' : 'salido';
  }

  elapsed(ticket: Ticket) {
    return durationText(minutesBetween(ticket.checkedInAt, ticket.checkedOutAt || this.now()));
  }

  value(ticket: Ticket) {
    if (ticket.monthlySubscription) return 'Mensual';
    if (ticket.status !== 'ACTIVE') return money(ticket.amountDue || 0);
    return money(estimateAmount(this.context.rule(ticket.vehicleType), minutesBetween(ticket.checkedInAt, this.now())));
  }

  meta = vehicleMeta;
  money = money;
  hhmm = hhmm;
  plate = displayPlate;

  private slots(items: Resource[], defaultIcon: string): SlotView[] {
    return [...items]
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map(item => {
        const ticket = item.assignedPlate ? this.activeByPlate().get(item.assignedPlate) : undefined;
        const monthly = item.reserved || !!ticket?.monthlySubscription;
        const state = item.occupied ? (monthly ? 'reservado' : 'ocupado') : (item.reserved ? 'reservado' : 'libre');
        const icon = state === 'libre' ? '○' : state === 'reservado' ? '⭐' : (ticket ? vehicleMeta(ticket.vehicleType).emoji : defaultIcon);
        return { code: item.code, state, icon, plate: item.assignedPlate ? displayPlate(item.assignedPlate) : '' };
      });
  }
}
