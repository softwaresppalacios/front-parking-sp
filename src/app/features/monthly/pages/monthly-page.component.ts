import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { MonthlySubscription } from '../../../core/models';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import { BackdropClickDirective } from '../../../shared/directives/backdrop-click.directive';
import {
  apiErrorMessage, VEHICLE_TYPES, cleanPlate, dateKey, daysUntil, displayPlate, formatPlate, money, parseDateKey, paymentMethodMeta, readStorage, shortDate,
  tenantHeaders, tenantIdFromRoute, vehicleMeta, whatsappUrl, writeStorage
} from '../../../core/utils';

type Status = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
type Tab = Status;
type Modal = 'new' | 'edit' | 'renew' | 'cancel' | null;

const DEFAULT_PRICES: Record<string, number> = { CAR: 40000, MOTORCYCLE: 20000, HEAVY: 80000, BICYCLE: 10000 };

@Component({
  selector: 'monthly-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BackdropClickDirective],
  templateUrl: './monthly-page.component.html'
})
export class MonthlyPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);
  /** Propietario o admin: pueden editar y cancelar. Renovar lo puede hacer cualquier rol. */
  canManage = inject(AuthService).canManage(this.tenantId);
  vehicleTypes = VEHICLE_TYPES;
  durations = [1, 2, 3, 6, 12];

  tab = signal<Tab>('ACTIVE');
  query = signal('');
  modal = signal<Modal>(null);
  saving = signal(false);
  /** Mensualidad sobre la que se edita, renueva o cancela. */
  selected = signal<MonthlySubscription | null>(null);
  lastWelcome = signal('');

  prices = readStorage<Record<string, number>>(this.pricesKey(), { ...DEFAULT_PRICES });
  form = this.emptyForm();
  editForm = { customerName: '', customerDocument: '', customerPhone: '', plate: '', vehicleType: 'CAR', amount: 0 };
  renewForm = { months: 1, amount: 0, paymentMethod: 'CASH', onlineReference: '' };
  cancelReason = '';

  /**
   * Una tarjeta por placa. Si una placa tiene varias filas (renovaciones antiguas guardadas como filas nuevas),
   * se muestra la no cancelada con vencimiento mas lejano; si todas estan canceladas, la ultima cancelada.
   */
  subscriptions = computed(() => {
    const byPlate = new Map<string, MonthlySubscription>();
    this.context.subscriptions().forEach(item => {
      const current = byPlate.get(item.plate);
      if (!current || this.rank(item) > this.rank(current)) byPlate.set(item.plate, item);
    });
    return [...byPlate.values()].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  });
  counts = computed(() => {
    const counts: Record<Status, number> = { ACTIVE: 0, EXPIRED: 0, CANCELLED: 0 };
    this.subscriptions().forEach(item => counts[this.statusOf(item)]++);
    return counts;
  });
  visible = computed(() => {
    const query = this.query().trim().toUpperCase();
    const queryPlate = cleanPlate(query);
    return this.subscriptions()
      .filter(item => this.statusOf(item) === this.tab())
      .filter(item => !query
        || item.customerName.toUpperCase().includes(query)
        || (queryPlate && item.plate.includes(queryPlate))
        || (item.customerDocument || '').includes(query));
  });
  expiring = computed(() => this.subscriptions().filter(item => this.statusOf(item) === 'ACTIVE' && daysUntil(item.expiresAt) <= 10));
  fixedIncome = computed(() => this.context.activeSubscriptions().reduce((sum, item) => sum + Number(item.amount || 0), 0));
  byType = computed(() => this.vehicleTypes
    .map(type => {
      const items = this.context.activeSubscriptions().filter(item => item.vehicleType === type);
      return { type, label: `${vehicleMeta(type).short}s`, count: items.length, amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0) };
    })
    .filter(row => row.count > 0));

  constructor() {
    this.context.refreshSubscriptions();
  }

  statusOf(item: MonthlySubscription): Status {
    if (item.status) return item.status;
    if (!item.active && item.cancelledAt) return 'CANCELLED';
    return daysUntil(item.expiresAt) < 0 ? 'EXPIRED' : 'ACTIVE';
  }

  days(item: MonthlySubscription) { return daysUntil(item.expiresAt); }

  daysClass(item: MonthlySubscription) {
    const days = this.days(item);
    return days <= 3 ? 'exp' : days <= 10 ? 'warn' : 'ok';
  }

  // ── Nueva ──
  openNew() {
    this.form = this.emptyForm();
    this.modal.set('new');
  }

  onTypeChange(type: string) {
    this.form.vehicleType = type;
    this.form.amount = this.prices[type] || 0;
  }

  onPlateChange(value: string) { this.form.plate = formatPlate(value); }

  endDate() {
    if (!this.form.startsAt) return '';
    const date = parseDateKey(this.form.startsAt);
    date.setMonth(date.getMonth() + (Number(this.form.months) || 1));
    return dateKey(date);
  }

  typeOption(type: string) {
    return `${vehicleMeta(type).emoji} ${vehicleMeta(type).short}`;
  }

  save() {
    const plate = cleanPlate(this.form.plate);
    if (!this.form.customerName.trim()) { this.toast.err('Ingrese el nombre del cliente'); return; }
    if (this.form.customerPhone.replace(/\D/g, '').length < 7) { this.toast.err('Ingrese el celular del cliente'); return; }
    if (plate.length < 5) { this.toast.err('Ingrese una placa válida'); return; }
    if (!(Number(this.form.amount) > 0)) { this.toast.err('Ingrese el valor de la mensualidad'); return; }
    this.saving.set(true);
    this.http.post<MonthlySubscription>(`${API.operation}/monthly-subscriptions`, {
      customerName: this.form.customerName.trim(),
      customerDocument: this.form.customerDocument.trim(),
      customerPhone: this.form.customerPhone.trim(),
      plate,
      vehicleType: this.form.vehicleType,
      amount: Number(this.form.amount),
      paymentMethod: this.form.paymentMethod,
      onlineReference: this.form.paymentMethod === 'ONLINE' ? this.form.onlineReference.trim() || null : null,
      startsAt: this.form.startsAt,
      months: Number(this.form.months) || 1
    }, tenantHeaders(this.tenantId)).subscribe({
      // El backend crea la mensualidad y registra su cobro en caja en la misma operacion.
      next: subscription => {
        this.rememberPrice(subscription.vehicleType, Number(this.form.amount));
        this.context.addSubscription(subscription);
        this.toast.ok(`Mensualidad registrada y pago ingresado a caja (${paymentMethodMeta(subscription.paymentMethod).label.toLowerCase()})`);
        this.prepareConfirmation(subscription, 'registrada');
        this.finish('ACTIVE');
      },
      error: err => this.fail(err, 'No se pudo registrar la mensualidad')
    });
  }

  // ── Editar ──
  openEdit(item: MonthlySubscription) {
    this.selected.set(item);
    this.editForm = {
      customerName: item.customerName,
      customerDocument: item.customerDocument || '',
      customerPhone: item.customerPhone || '',
      plate: displayPlate(item.plate),
      vehicleType: item.vehicleType,
      amount: Number(item.amount) || 0
    };
    this.modal.set('edit');
  }

  onEditPlateChange(value: string) { this.editForm.plate = formatPlate(value); }

  saveEdit() {
    const item = this.selected();
    if (!item) return;
    const plate = cleanPlate(this.editForm.plate);
    if (!this.editForm.customerName.trim()) { this.toast.err('Ingrese el nombre del cliente'); return; }
    if (plate.length < 5) { this.toast.err('Ingrese una placa válida'); return; }
    if (!(Number(this.editForm.amount) >= 0)) { this.toast.err('Ingrese el valor mensual'); return; }
    this.saving.set(true);
    this.http.put<MonthlySubscription>(`${API.operation}/monthly-subscriptions/${item.uuid}`, {
      customerName: this.editForm.customerName.trim(),
      customerDocument: this.editForm.customerDocument.trim(),
      customerPhone: this.editForm.customerPhone.trim(),
      plate,
      vehicleType: this.editForm.vehicleType,
      amount: Number(this.editForm.amount)
    }, tenantHeaders(this.tenantId)).subscribe({
      next: updated => {
        this.context.replaceSubscription(updated);
        this.toast.ok(`Mensualidad de ${displayPlate(updated.plate)} actualizada`);
        this.finish();
      },
      error: err => this.fail(err, 'No se pudo actualizar la mensualidad')
    });
  }

  // ── Renovar ──
  openRenew(item: MonthlySubscription) {
    this.selected.set(item);
    this.renewForm = { months: 1, amount: Number(item.amount) || 0, paymentMethod: 'CASH', onlineReference: '' };
    this.modal.set('renew');
  }

  onRenewMonthsChange(months: number) {
    this.renewForm.months = months;
    this.renewForm.amount = (Number(this.selected()?.amount) || 0) * months;
  }

  /** Periodo que cubrira la renovacion: desde el vencimiento si sigue vigente, desde hoy si ya vencio. */
  renewPeriod() {
    const item = this.selected();
    if (!item) return { from: '', to: '' };
    const from = this.days(item) < 0 ? new Date() : parseDateKey(item.expiresAt);
    const to = new Date(from);
    to.setMonth(to.getMonth() + (Number(this.renewForm.months) || 1));
    return { from: dateKey(from), to: dateKey(to) };
  }

  saveRenew() {
    const item = this.selected();
    if (!item) return;
    if (!(Number(this.renewForm.amount) > 0)) { this.toast.err('Ingrese el valor a cobrar'); return; }
    this.saving.set(true);
    this.http.post<MonthlySubscription>(`${API.operation}/monthly-subscriptions/${item.uuid}/renew`, {
      months: Number(this.renewForm.months) || 1,
      amount: Number(this.renewForm.amount),
      paymentMethod: this.renewForm.paymentMethod,
      onlineReference: this.renewForm.paymentMethod === 'ONLINE' ? this.renewForm.onlineReference.trim() || null : null
    }, tenantHeaders(this.tenantId)).subscribe({
      next: renewed => {
        this.context.replaceSubscription(renewed);
        this.toast.ok(`Mensualidad de ${displayPlate(renewed.plate)} renovada hasta el ${shortDate(renewed.expiresAt)} · ${money(this.renewForm.amount)} a caja`);
        this.prepareConfirmation(renewed, 'renovada');
        this.finish('ACTIVE');
      },
      error: err => this.fail(err, 'No se pudo renovar la mensualidad')
    });
  }

  // ── Cancelar ──
  openCancel(item: MonthlySubscription) {
    this.selected.set(item);
    this.cancelReason = '';
    this.modal.set('cancel');
  }

  confirmCancel() {
    const item = this.selected();
    if (!item) return;
    this.saving.set(true);
    this.http.post<MonthlySubscription>(`${API.operation}/monthly-subscriptions/${item.uuid}/cancel`, {
      reason: this.cancelReason.trim() || null
    }, tenantHeaders(this.tenantId)).subscribe({
      next: cancelled => {
        this.context.replaceSubscription(cancelled);
        this.toast.ok(`Mensualidad de ${displayPlate(cancelled.plate)} cancelada`);
        this.finish();
      },
      error: err => this.fail(err, 'No se pudo cancelar la mensualidad')
    });
  }

  closeModal() {
    if (!this.saving()) this.modal.set(null);
  }

  remind(item: MonthlySubscription) {
    const first = item.customerName.split(' ')[0];
    const text = [
      `Hola ${first} 👋`,
      `Te recordamos que tu mensualidad en ${this.context.parkingName()} para ${displayPlate(item.plate)} vence el ${shortDate(item.expiresAt)}.`,
      'Renuévala para seguir disfrutando tu espacio. ¡Gracias! 🅿️'
    ].join('\n');
    window.open(whatsappUrl(item.customerPhone, text), '_blank');
    this.toast.ok(`Recordatorio abierto en WhatsApp para ${first}`, '📲');
  }

  shortDate = shortDate;
  money = money;
  plate = displayPlate;
  meta = vehicleMeta;
  methodLabel = (method?: string) => paymentMethodMeta(method).label;

  /** Mayor prioridad: no cancelada; entre iguales, la que vence mas tarde. */
  private rank(item: MonthlySubscription) {
    return (this.statusOf(item) === 'CANCELLED' ? 0 : 1e10) + parseDateKey(item.expiresAt).getTime() / 1e5;
  }

  private finish(tab?: Tab) {
    this.saving.set(false);
    this.modal.set(null);
    if (tab) this.tab.set(tab);
  }

  private fail(err: unknown, fallback: string) {
    this.toast.err(apiErrorMessage(err as { status?: number; error?: { message?: string } }, fallback));
    this.saving.set(false);
  }

  private rememberPrice(type: string, amount: number) {
    this.prices = { ...this.prices, [type]: amount };
    writeStorage(this.pricesKey(), this.prices);
  }

  private prepareConfirmation(subscription: MonthlySubscription, action: 'registrada' | 'renovada') {
    if (!subscription.customerPhone) return;
    const text = [
      '🅿️ *SP Parqueaderos*',
      `Mensualidad ${action} en ${this.context.parkingName()}`,
      `Placa: ${displayPlate(subscription.plate)}`,
      `Vigencia: ${shortDate(subscription.startsAt)} al ${shortDate(subscription.expiresAt)}`
    ].join('\n');
    this.lastWelcome.set(whatsappUrl(subscription.customerPhone, text));
  }

  private emptyForm() {
    return {
      customerName: '',
      customerDocument: '',
      customerPhone: '',
      plate: '',
      vehicleType: 'CAR',
      amount: this.prices?.['CAR'] ?? DEFAULT_PRICES['CAR'],
      paymentMethod: 'CASH',
      onlineReference: '',
      startsAt: dateKey(new Date()),
      months: 1
    };
  }

  private pricesKey() { return `sp_monthly_prices_${tenantIdFromRoute(this.route)}`; }
}
