import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { CashPayment, CashSession } from '../../../core/models';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import { BackdropClickDirective } from '../../../shared/directives/backdrop-click.directive';
import {
  apiErrorMessage, dateKey, displayPlate, durationText, hhmm, minutesBetween, money, paymentMethodMeta, shortDate, shortDay, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

/**
 * Turno de caja abierto: cobros por horas o dia y mensualidades, en efectivo o en linea.
 * Al cerrar, el cajero cuenta el efectivo y queda registrada la diferencia con lo esperado.
 */
@Component({
  selector: 'cash-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BackdropClickDirective],
  templateUrl: './cash-page.component.html'
})
export class CashPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);
  /** El historial de cierres es solo para propietario y admin. */
  canManage = inject(AuthService).canManage(this.tenantId);

  /** undefined mientras carga; null si no hay caja abierta. */
  session = signal<CashSession | null | undefined>(undefined);
  previous = signal<CashSession[]>([]);
  openModal = signal(false);
  closeModal = signal(false);
  saving = signal(false);
  openingFloat: number | null = 0;
  countedCash: number | null = null;
  notes = '';

  payments = computed(() => this.session()?.payments || []);
  totals = computed(() => this.session()?.totals);
  average = computed(() => {
    const totals = this.totals();
    return totals?.vehicles ? Math.round(totals.parking / totals.vehicles) : 0;
  });

  hourly = computed(() => {
    const schedule = this.context.todaySchedule();
    const start = schedule?.openTime ? Number(schedule.openTime.slice(0, 2)) : 6;
    const end = schedule?.closeTime ? Number(schedule.closeTime.slice(0, 2)) : 18;
    const buckets = new Map<number, number>();
    for (let hour = start; hour <= Math.max(start, end); hour++) buckets.set(hour, 0);
    this.payments().forEach(payment => {
      const hour = new Date(payment.paidAt).getHours();
      buckets.set(hour, (buckets.get(hour) || 0) + Number(payment.amount));
    });
    const entries = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const max = Math.max(1, ...entries.map(([, value]) => value));
    return entries.map(([hour, value]) => ({ label: String(hour % 12 || 12), value, pct: Math.round(value / max * 100) }));
  });

  constructor() {
    this.load();
  }

  load() {
    this.http.get<{ session: CashSession | null }>(`${API.payment}/cash-sessions/current`, tenantHeaders(this.tenantId)).subscribe({
      next: response => this.session.set(response.session),
      error: () => { this.session.set(null); this.toast.err('No se pudo cargar la caja'); }
    });
    if (this.canManage) this.loadPrevious();
  }

  startOpen() {
    this.openingFloat = 0;
    this.openModal.set(true);
  }

  confirmOpen() {
    const base = Number(this.openingFloat);
    if (this.openingFloat === null || !(base >= 0)) { this.toast.err('Ingrese la base de efectivo (puede ser 0)'); return; }
    this.saving.set(true);
    this.http.post<CashSession>(`${API.payment}/cash-sessions/open`, { openingFloat: base }, tenantHeaders(this.tenantId)).subscribe({
      next: session => {
        this.session.set(session);
        this.saving.set(false);
        this.openModal.set(false);
        this.toast.ok(`Caja abierta con base de ${money(base)}`, '◈');
      },
      error: (err: HttpErrorResponse) => this.fail(err, 'No se pudo abrir la caja')
    });
  }

  startClose() {
    this.countedCash = null;
    this.notes = '';
    this.closeModal.set(true);
  }

  confirmClose() {
    const counted = Number(this.countedCash);
    if (this.countedCash === null || !(counted >= 0)) { this.toast.err('Ingrese el efectivo contado en caja'); return; }
    this.saving.set(true);
    this.http.post<CashSession>(`${API.payment}/cash-sessions/current/close`, { countedCash: counted, notes: this.notes.trim() || null }, tenantHeaders(this.tenantId)).subscribe({
      next: closed => {
        this.saving.set(false);
        this.closeModal.set(false);
        this.session.set(null);
        const diff = Number(closed.cashDifference) || 0;
        const detail = diff === 0 ? 'Efectivo cuadrado' : diff < 0 ? `Faltante de ${money(-diff)}` : `Sobrante de ${money(diff)}`;
        this.toast.ok(`Caja cerrada. Total: ${money(closed.totals.total)}. ${detail}`, '◈');
        if (this.canManage) this.loadPrevious();
      },
      error: (err: HttpErrorResponse) => this.fail(err, 'No se pudo cerrar la caja')
    });
  }

  row(payment: CashPayment, index: number) {
    const monthly = payment.concept === 'MONTHLY';
    const exit = payment.checkedOutAt || payment.paidAt;
    return {
      n: String(index + 1).padStart(3, '0'),
      plate: payment.plate ? displayPlate(payment.plate) : '—',
      vehicleType: payment.vehicleType || 'CAR',
      monthly,
      entry: monthly || !payment.checkedInAt ? '—' : hhmm(payment.checkedInAt),
      exit: hhmm(exit),
      duration: monthly ? (payment.description || 'Mensualidad') : payment.checkedInAt ? durationText(minutesBetween(payment.checkedInAt, exit)) : '—'
    };
  }

  /** Efectivo contado menos el esperado; null hasta que se escriba el conteo. */
  difference() {
    if (this.countedCash === null || (this.countedCash as unknown) === '') return null;
    return Number(this.countedCash) - Number(this.session()?.expectedCash || 0);
  }

  differenceText(value: number | null | undefined) {
    const diff = Number(value) || 0;
    if (diff === 0) return 'Cuadrada';
    return diff < 0 ? `Faltan ${money(-diff)}` : `Sobran ${money(diff)}`;
  }

  sessionLabel(item: CashSession) {
    const date = new Date(item.openedAt);
    return `${shortDay(date)} ${shortDate(dateKey(date))} · ${hhmm(item.openedAt)}`;
  }

  method = paymentMethodMeta;
  meta = vehicleMeta;
  money = money;
  hhmm = hhmm;

  private loadPrevious() {
    const from = new Date();
    from.setDate(from.getDate() - 60);
    this.http.get<CashSession[]>(`${API.payment}/cash-sessions`, {
      ...tenantHeaders(this.tenantId),
      params: { from: dateKey(from), to: dateKey(new Date()), status: 'CLOSED' }
    }).subscribe({
      next: sessions => this.previous.set(sessions.slice(0, 5)),
      error: () => this.previous.set([])
    });
  }

  private fail(err: HttpErrorResponse, fallback: string) {
    this.saving.set(false);
    this.toast.err(apiErrorMessage(err, fallback));
    // La caja pudo cambiar en otro equipo (otro cajero abrio o cerro): se recarga.
    if (err.status === 409) this.load();
  }
}
