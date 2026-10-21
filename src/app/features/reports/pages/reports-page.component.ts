import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Report, ReportPayment } from '../../../core/models';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  apiErrorMessage, compactMoney, dateKey, displayPlate, downloadCsv, durationText, hhmm, minutesBetween, money, parseDateKey,
  paymentMethodMeta, shortDate, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

type Filters = { from: string; to: string; type: string };

const TYPE_STYLE: Record<string, { color: string; fill: string }> = {
  CAR: { color: 'var(--blue)', fill: 'red' },
  MOTORCYCLE: { color: 'var(--purple)', fill: 'green' },
  HEAVY: { color: 'var(--amber)', fill: 'blue' },
  BICYCLE: { color: 'var(--teal)', fill: 'amber' }
};
/** Dias que caben legibles en la grafica de barras. */
const CHART_DAYS = 31;

/** Reportes calculados en el servidor (reporting-audit-service) con los cobros de caja y los tickets. */
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
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);

  form: Filters = this.defaultFilters();
  report = signal<Report | null>(null);
  loading = signal(false);
  error = signal('');

  totals = computed(() => this.report()?.totals ?? null);
  chart = computed(() => {
    const daily = (this.report()?.daily ?? []).slice(-CHART_DAYS);
    const max = Math.max(1, ...daily.map(day => Number(day.revenue) || 0));
    return daily.map(day => ({
      key: day.date,
      label: String(parseDateKey(day.date).getDate()),
      value: Number(day.revenue) || 0,
      entries: day.entries,
      pct: Math.round((Number(day.revenue) || 0) / max * 100)
    }));
  });
  chartTrimmed = computed(() => (this.report()?.daily.length ?? 0) > CHART_DAYS);
  byType = computed(() => {
    const rows = this.report()?.byVehicleType ?? [];
    const total = Math.max(1, rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0));
    return rows.map(row => ({
      ...row,
      label: `${vehicleMeta(row.vehicleType).emoji} ${vehicleMeta(row.vehicleType).short}s`,
      pct: Math.round(Number(row.revenue || 0) / total * 100),
      ...(TYPE_STYLE[row.vehicleType] ?? TYPE_STYLE['CAR'])
    }));
  });
  methodPct = computed(() => {
    const totals = this.totals();
    const total = Number(totals?.revenue) || 0;
    return total ? Math.round((Number(totals?.cashRevenue) || 0) / total * 100) : 0;
  });

  constructor() {
    this.generate(false);
  }

  generate(announce = true) {
    if (this.form.from > this.form.to) { this.toast.err('La fecha inicio debe ser anterior a la fecha fin'); return; }
    this.loading.set(true);
    this.error.set('');
    let params = new HttpParams().set('from', this.form.from).set('to', this.form.to);
    if (this.form.type) params = params.set('vehicleType', this.form.type);
    this.http.get<Report>(`${API.reporting}/reports`, { ...tenantHeaders(this.tenantId), params }).subscribe({
      next: report => {
        this.report.set(report);
        this.loading.set(false);
        if (announce) this.toast.ok(`${report.totals.entries} entradas y ${report.payments.length} cobros en el período`, '↗');
      },
      error: err => {
        const message = apiErrorMessage(err, 'No se pudo generar el reporte');
        this.error.set(message);
        this.toast.err(message);
        this.loading.set(false);
      }
    });
  }

  print() { window.print(); }

  exportCsv() {
    const report = this.report();
    if (!report?.payments.length) { this.toast.err('No hay cobros para exportar en el período'); return; }
    downloadCsv(`reporte_${report.from}_${report.to}.csv`, [
      ['Fecha', 'Hora', 'Concepto', 'Placa', 'Tipo', 'Entrada', 'Salida', 'Tiempo', 'Método', 'Valor', 'Cobró', 'Descripción'],
      ...report.payments.map(row => [
        dateKey(row.paidAt), hhmm(row.paidAt), row.concept === 'MONTHLY' ? 'Mensualidad' : 'Parqueo',
        displayPlate(row.plate), row.vehicleType ? vehicleMeta(row.vehicleType).short : '',
        row.checkedInAt ? hhmm(row.checkedInAt) : '', row.checkedOutAt ? hhmm(row.checkedOutAt) : '', this.duration(row),
        paymentMethodMeta(row.method).label, Number(row.amount) || 0, row.registeredByName || '', row.description || ''
      ])
    ]);
    this.toast.ok('Reporte exportado a Excel (CSV)', '📊');
  }

  rangeLabel() {
    const report = this.report();
    if (!report) return '';
    return `${shortDate(report.from)} – ${shortDate(report.to)}, ${parseDateKey(report.to).getFullYear()}`;
  }

  duration(row: ReportPayment) {
    return row.checkedInAt && row.checkedOutAt ? durationText(minutesBetween(row.checkedInAt, row.checkedOutAt)) : '—';
  }

  methodMeta = paymentMethodMeta;
  meta = vehicleMeta;
  money = money;
  compact = compactMoney;
  hhmm = hhmm;
  shortDate = shortDate;
  plate = displayPlate;
  dateKey = dateKey;
  durationText = durationText;

  private defaultFilters(): Filters {
    const today = new Date();
    return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateKey(today), type: '' };
  }
}
