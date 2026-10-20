import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { CashPayment, CashSession } from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';
import {
  apiErrorMessage, compactMoney, dateKey, displayPlate, downloadCsv, durationText, hhmm, minutesBetween, money, parseDateKey, paymentMethodMeta,
  shortDate, shortDay, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

type Filters = { from: string; to: string; responsible: string; status: '' | 'OPEN' | 'CLOSED' };

/** Historial de turnos de caja (payment-cash-service), solo para propietario y admin. */
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
  tenantId = tenantIdFromRoute(this.route);
  detailPanel = viewChild<ElementRef<HTMLElement>>('detailPanel');

  form: Filters = this.defaultFilters();
  applied = signal<Filters>(this.defaultFilters());
  rows = signal<CashSession[]>([]);
  loading = signal(false);
  /** Responsables vistos en cualquier consulta, para el filtro. */
  responsibles = signal<string[]>([]);
  selected = signal<CashSession | null>(null);

  total = computed(() => this.rows().reduce((sum, row) => sum + Number(row.totals.total), 0));
  cash = computed(() => this.rows().reduce((sum, row) => sum + Number(row.totals.cash), 0));
  online = computed(() => this.rows().reduce((sum, row) => sum + Number(row.totals.online), 0));
  pending = computed(() => this.rows().filter(row => row.status === 'OPEN').length);

  constructor() {
    this.load();
  }

  filter() {
    if (this.form.from > this.form.to) { this.toast.err('La fecha inicio debe ser anterior a la fecha fin'); return; }
    this.applied.set({ ...this.form });
    this.selected.set(null);
    this.load(true);
  }

  select(row: CashSession) {
    this.http.get<CashSession>(`${API.payment}/cash-sessions/${row.uuid}`, tenantHeaders(this.tenantId)).subscribe({
      next: detail => {
        this.selected.set(detail);
        window.setTimeout(() => this.detailPanel()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      },
      error: err => this.toast.err(apiErrorMessage(err, 'No se pudo cargar el detalle del turno'))
    });
  }

  exportAll() {
    if (!this.rows().length) { this.toast.err('No hay turnos para exportar'); return; }
    downloadCsv(`reporte_caja_${this.applied().from}_${this.applied().to}.csv`, [
      ['Fecha', 'Día', 'Apertura', 'Abrió', 'Cierre', 'Cerró', 'Vehículos', 'Efectivo', 'En línea', 'Por horas/día', 'Mensualidades', 'Total',
        'Base', 'Efectivo esperado', 'Efectivo contado', 'Diferencia', 'Estado', 'Observaciones'],
      ...this.rows().map(row => [
        this.date(row), this.day(row), hhmm(row.openedAt), row.openedByName || '', row.closedAt ? hhmm(row.closedAt) : '', row.closedByName || '',
        row.totals.vehicles, row.totals.cash, row.totals.online, row.totals.parking, row.totals.monthly, row.totals.total,
        row.openingFloat, row.expectedCash, row.countedCash ?? '', row.cashDifference ?? '', this.statusLabel(row), row.notes || ''
      ])
    ]);
    this.toast.ok('Excel generado con todos los turnos', '📊');
  }

  exportDetail() {
    const row = this.selected();
    if (!row) return;
    downloadCsv(`caja_${this.date(row)}_${hhmm(row.openedAt).replace(/\D/g, '')}.csv`, [
      ['Turno de caja', this.date(row), this.day(row), this.statusLabel(row)],
      ['Abrió', row.openedByName || '', 'Apertura', hhmm(row.openedAt), 'Cerró', row.closedByName || '', 'Cierre', row.closedAt ? hhmm(row.closedAt) : ''],
      ['Total', row.totals.total, 'Efectivo', row.totals.cash, 'En línea', row.totals.online, 'Mensualidades', row.totals.monthly],
      ['Base', row.openingFloat, 'Esperado', row.expectedCash, 'Contado', row.countedCash ?? '', 'Diferencia', row.cashDifference ?? ''],
      ['Observaciones', row.notes || ''],
      [],
      ['#', 'Placa', 'Concepto', 'Entrada', 'Salida', 'Tiempo', 'Método', 'Referencia', 'Cobró', 'Valor'],
      ...(row.payments || []).map((payment, index) => {
        const r = this.paymentRow(payment);
        return [index + 1, r.plate, r.monthly ? 'Mensualidad' : vehicleMeta(r.vehicleType).short, r.entry, r.exit, r.duration,
          paymentMethodMeta(payment.method).label, payment.onlineReference || '', payment.registeredByName || '', payment.amount];
      })
    ]);
    this.toast.ok(`Excel exportado: turno del ${this.date(row)}`, '📥');
  }

  paymentRow(payment: CashPayment) {
    const monthly = payment.concept === 'MONTHLY';
    const exit = payment.checkedOutAt || payment.paidAt;
    return {
      plate: payment.plate ? displayPlate(payment.plate) : '—',
      vehicleType: payment.vehicleType || 'CAR',
      monthly,
      entry: monthly || !payment.checkedInAt ? '—' : hhmm(payment.checkedInAt),
      exit: hhmm(exit),
      duration: monthly ? (payment.description || 'Mensualidad') : payment.checkedInAt ? durationText(minutesBetween(payment.checkedInAt, exit)) : '—'
    };
  }

  date(row: CashSession) { return dateKey(row.openedAt); }
  day(row: CashSession) { return shortDay(new Date(row.openedAt)); }
  responsible(row: CashSession) { return row.closedByName || row.openedByName || '—'; }
  statusLabel(row: CashSession) { return row.status === 'OPEN' ? 'Abierta' : 'Cerrada'; }
  isWeekend(row: CashSession) { const day = new Date(row.openedAt).getDay(); return day === 0 || day === 6; }
  pct(value: number) { return this.total() ? Math.round(value / this.total() * 100) : 0; }
  average(row: CashSession) { return row.totals.vehicles ? Math.round(row.totals.parking / row.totals.vehicles) : 0; }
  rangeLabel() { return `${shortDate(this.applied().from)} – ${shortDate(this.applied().to)}, ${parseDateKey(this.applied().to).getFullYear()}`; }
  differenceText(value: number | null | undefined) {
    if (value === null || value === undefined) return '—';
    const diff = Number(value);
    if (diff === 0) return 'Cuadrada';
    return diff < 0 ? `−${money(-diff)}` : `+${money(diff)}`;
  }
  differenceColor(value: number | null | undefined) {
    const diff = Number(value) || 0;
    return value === null || value === undefined ? 'var(--text3)' : diff < 0 ? 'var(--red)' : diff > 0 ? 'var(--amber)' : 'var(--green)';
  }

  method = paymentMethodMeta;
  meta = vehicleMeta;
  money = money;
  compact = compactMoney;
  hhmm = hhmm;

  private load(announce = false) {
    const { from, to, responsible, status } = this.applied();
    const params: Record<string, string> = { from, to };
    if (responsible) params['responsible'] = responsible;
    if (status) params['status'] = status;
    this.loading.set(true);
    this.http.get<CashSession[]>(`${API.payment}/cash-sessions`, { ...tenantHeaders(this.tenantId), params }).subscribe({
      next: rows => {
        this.rows.set(rows);
        this.loading.set(false);
        const names = new Set([...this.responsibles(), ...rows.map(row => this.responsible(row)).filter(name => name !== '—')]);
        this.responsibles.set([...names].sort());
        if (announce) this.toast.ok(`${rows.length} turnos encontrados`);
      },
      error: err => {
        this.rows.set([]);
        this.loading.set(false);
        this.toast.err(apiErrorMessage(err, 'No se pudo cargar el historial de caja'));
      }
    });
  }

  private defaultFilters(): Filters {
    const today = new Date();
    return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateKey(today), responsible: '', status: '' };
  }
}
