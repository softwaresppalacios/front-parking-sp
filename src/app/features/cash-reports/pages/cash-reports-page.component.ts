import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { CashClosure, CashSummary, Ticket } from '../../../core/models';
import { LocalHistoryService } from '../../../core/state/local-history.service';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  compactMoney, dateKey, downloadCsv, hhmm, money, parseDateKey, sessionUserName, shortDate, shortDay, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

type ClosureRow = CashClosure & { status: 'Cerrada' | 'Abierta'; day: string };
type Filters = { from: string; to: string; responsible: string; status: string };

@Component({
  selector: 'cash-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-reports-page.component.html'
})
export class CashReportsPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private history = inject(LocalHistoryService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);
  detailPanel = viewChild<ElementRef<HTMLElement>>('detailPanel');

  form: Filters = this.defaultFilters();
  applied = signal<Filters>(this.defaultFilters());
  closures = signal<CashClosure[]>([]);
  openSession = signal<CashClosure | null>(null);
  selected = signal<ClosureRow | null>(null);

  allRows = computed<ClosureRow[]>(() => {
    const closed = this.closures().map(item => ({ ...item, status: 'Cerrada' as const, day: shortDay(parseDateKey(item.date)) }));
    const open = this.openSession();
    const rows = open && !closed.some(item => item.date === open.date)
      ? [{ ...open, status: 'Abierta' as const, day: shortDay(parseDateKey(open.date)) }, ...closed]
      : closed;
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  });
  responsibles = computed(() => [...new Set(this.allRows().map(row => row.responsible))].sort());
  rows = computed(() => {
    const { from, to, responsible, status } = this.applied();
    return this.allRows().filter(row => row.date >= from && row.date <= to
      && (!responsible || row.responsible === responsible)
      && (!status || row.status === status));
  });
  total = computed(() => this.rows().reduce((sum, row) => sum + row.total, 0));
  cash = computed(() => this.rows().reduce((sum, row) => sum + row.cash, 0));
  digital = computed(() => this.rows().reduce((sum, row) => sum + row.digital, 0));
  pending = computed(() => this.rows().filter(row => row.status === 'Abierta').length);

  constructor() {
    this.load();
  }

  load() {
    this.closures.set(this.history.closures(this.tenantId));
    const headers = tenantHeaders(this.tenantId);
    this.http.get<CashSummary>(`${API.payment}/cash-sessions/current`, headers).subscribe({
      next: summary => {
        if (!summary.movements) { this.openSession.set(null); return; }
        this.http.get<Ticket[]>(`${API.operation}/tickets/recent`, headers).subscribe({
          next: recent => { this.history.mergeTickets(this.tenantId, recent); this.buildOpenSession(summary); },
          error: () => this.buildOpenSession(summary)
        });
      },
      error: () => this.openSession.set(null)
    });
  }

  filter() {
    if (this.form.from > this.form.to) { this.toast.err('La fecha inicio debe ser anterior a la fecha fin'); return; }
    this.toast.info('Filtrando cierres...', '⌕');
    this.applied.set({ ...this.form });
    this.selected.set(null);
    window.setTimeout(() => this.toast.ok(`${this.rows().length} cierres encontrados`), 400);
  }

  select(row: ClosureRow) {
    this.selected.set(row);
    window.setTimeout(() => this.detailPanel()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  exportAll() {
    if (!this.rows().length) { this.toast.err('No hay cierres para exportar'); return; }
    downloadCsv(`reporte_cierres_${this.applied().from}_${this.applied().to}.csv`, [
      ['Fecha', 'Día', 'Apertura', 'Cierre', 'Responsable', 'Vehículos', 'Efectivo', 'Digital', 'Mensualidades', 'Total', 'Estado', 'Observaciones'],
      ...this.rows().map(row => [row.date, row.day, row.openedAt, row.closedAt, row.responsible, row.vehicles, row.cash, row.digital, row.monthly, row.total, row.status, row.notes])
    ]);
    this.toast.ok('Excel generado con todos los cierres', '📊');
  }

  exportDay() {
    const row = this.selected();
    if (!row) return;
    downloadCsv(`cierre_${row.date}.csv`, [
      ['Cierre de caja', row.date, row.day],
      ['Responsable', row.responsible, 'Apertura', row.openedAt, 'Cierre', row.closedAt],
      ['Total', row.total, 'Efectivo', row.cash, 'Digital', row.digital, 'Mensualidades', row.monthly],
      ['Observaciones', row.notes],
      [],
      ['#', 'Placa', 'Tipo', 'Entrada', 'Salida', 'Tiempo', 'Método', 'Valor'],
      ...row.movements.map(movement => [
        movement.n, movement.plate, movement.monthly ? 'Mensualidad' : vehicleMeta(movement.vehicleType).short,
        movement.entry, movement.exit, movement.duration, movement.method === 'CASH' ? 'Efectivo' : 'Digital', movement.amount
      ])
    ]);
    this.toast.ok(`Excel exportado: cierre del ${row.date}`, '📥');
  }

  pct(value: number) { return this.total() ? Math.round(value / this.total() * 100) : 0; }
  average(row: ClosureRow) { return row.vehicles ? Math.round((row.total - row.monthly) / row.vehicles) : 0; }
  rangeLabel() { return `${shortDate(this.applied().from)} – ${shortDate(this.applied().to)}, ${parseDateKey(this.applied().to).getFullYear()}`; }
  isWeekend(row: ClosureRow) { return row.day === 'Sáb' || row.day === 'Dom'; }

  meta = vehicleMeta;
  money = money;
  compact = compactMoney;

  private buildOpenSession(summary: CashSummary) {
    const rows = this.history.movementRows(summary.recentMovements || [], this.history.tickets(this.tenantId), this.context.subscriptions());
    const monthly = rows.filter(row => row.monthly).reduce((sum, row) => sum + row.amount, 0);
    this.openSession.set({
      id: 'open',
      date: dateKey(new Date()),
      openedAt: this.context.todaySchedule()?.openTime?.slice(0, 5) || (rows[0] ? hhmm(rows[0].paidAt) : '—'),
      closedAt: '—',
      responsible: sessionUserName(),
      vehicles: rows.filter(row => !row.monthly).length,
      cash: Number(summary.cashRevenue) || 0,
      digital: Number(summary.digitalRevenue) || 0,
      monthly,
      total: Number(summary.todayRevenue) || 0,
      notes: 'Caja abierta — pendiente de cierre',
      movements: rows
    });
  }

  private defaultFilters(): Filters {
    const today = new Date();
    return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateKey(today), responsible: '', status: '' };
  }
}
