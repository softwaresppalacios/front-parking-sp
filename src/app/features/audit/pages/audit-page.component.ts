import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { AuditEntry, AuditPage } from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';
import { apiErrorMessage, dateKey, downloadCsv, hhmm, shortDate, tenantHeaders, tenantIdFromRoute } from '../../../core/utils';

type Filters = { from: string; to: string; action: string; actor: string; q: string };

/** Etiqueta y color de cada accion auditada. */
export const AUDIT_ACTIONS: Record<string, { label: string; cls: string }> = {
  CHECK_IN: { label: 'Entrada', cls: 'green' },
  CHECK_OUT: { label: 'Salida', cls: 'blue' },
  MONTHLY_CREATE: { label: 'Mensualidad creada', cls: 'green' },
  MONTHLY_UPDATE: { label: 'Mensualidad editada', cls: 'amber' },
  MONTHLY_RENEW: { label: 'Mensualidad renovada', cls: 'green' },
  MONTHLY_CANCEL: { label: 'Mensualidad cancelada', cls: 'red' },
  MONTHLY_REMINDER: { label: 'Recordatorio de mensualidad', cls: 'blue' },
  CASH_OPEN: { label: 'Apertura de caja', cls: 'blue' },
  CASH_CLOSE: { label: 'Cierre de caja', cls: 'blue' },
  TARIFF_UPDATE: { label: 'Tarifa modificada', cls: 'amber' },
  BRANCH_UPDATE: { label: 'Configuración de sede', cls: 'amber' },
  MEMBER_ADD: { label: 'Usuario agregado', cls: 'green' },
  MEMBER_UPDATE: { label: 'Usuario modificado', cls: 'amber' },
  MEMBER_REMOVE: { label: 'Usuario retirado', cls: 'red' },
  MEMBER_RESET_PASSWORD: { label: 'Clave restablecida', cls: 'red' }
};

@Component({
  selector: 'audit-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-page.component.html'
})
export class AuditPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  tenantId = tenantIdFromRoute(this.route);
  actions = Object.entries(AUDIT_ACTIONS).map(([key, value]) => ({ key, label: value.label }));

  form: Filters = this.defaultFilters();
  page = signal<AuditPage | null>(null);
  loading = signal(false);
  error = signal('');

  constructor() {
    this.search(false);
  }

  search(announce = true) {
    if (this.form.from > this.form.to) { this.toast.err('La fecha inicio debe ser anterior a la fecha fin'); return; }
    this.loading.set(true);
    this.error.set('');
    let params = new HttpParams().set('from', this.form.from).set('to', this.form.to);
    if (this.form.action) params = params.set('action', this.form.action);
    if (this.form.actor) params = params.set('actor', this.form.actor);
    if (this.form.q.trim()) params = params.set('q', this.form.q.trim());
    this.http.get<AuditPage>(`${API.reporting}/audit`, { ...tenantHeaders(this.tenantId), params }).subscribe({
      next: page => {
        this.page.set(page);
        this.loading.set(false);
        if (announce) this.toast.ok(`${page.entries.length} registros encontrados`, '⌕');
      },
      error: err => {
        const message = apiErrorMessage(err, 'No se pudo consultar la auditoría');
        this.error.set(message);
        this.toast.err(message);
        this.loading.set(false);
      }
    });
  }

  clear() {
    this.form = this.defaultFilters();
    this.search(false);
  }

  exportCsv() {
    const entries = this.page()?.entries ?? [];
    if (!entries.length) { this.toast.err('No hay registros para exportar'); return; }
    downloadCsv(`auditoria_${this.form.from}_${this.form.to}.csv`, [
      ['Fecha', 'Hora', 'Usuario', 'Acción', 'Referencia', 'Detalle', 'Origen'],
      ...entries.map(entry => [
        dateKey(entry.createdAt), hhmm(entry.createdAt), entry.actor || '', this.actionMeta(entry.action).label,
        entry.entityRef || '', entry.details || '', entry.source || ''
      ])
    ]);
    this.toast.ok('Auditoría exportada a Excel (CSV)', '📊');
  }

  actionMeta(action: string) {
    return AUDIT_ACTIONS[action] ?? { label: action, cls: '' };
  }

  trackById = (_: number, entry: AuditEntry) => entry.id;
  shortDate = shortDate;
  hhmm = hhmm;
  dateKey = dateKey;

  private defaultFilters(): Filters {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: dateKey(weekAgo), to: dateKey(today), action: '', actor: '', q: '' };
  }
}
