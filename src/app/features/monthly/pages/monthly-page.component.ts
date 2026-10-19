import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { MonthlySubscription } from '../../../core/models';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import { BackdropClickDirective } from '../../../shared/directives/backdrop-click.directive';
import {
  VEHICLE_TYPES, cleanPlate, dateKey, daysUntil, displayPlate, formatPlate, money, parseDateKey, readStorage, shortDate,
  tenantHeaders, tenantIdFromRoute, vehicleMeta, whatsappUrl, writeStorage
} from '../../../core/utils';

type ClientGroup = {
  key: string;
  name: string;
  document: string;
  phone: string;
  plates: string[];
  typeText: string;
  amount: number;
  expiresAt: string;
  days: number;
  latest: MonthlySubscription;
};

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
  vehicleTypes = VEHICLE_TYPES;
  durations = [1, 2, 3, 6, 12];

  modalOpen = signal(false);
  renewing = signal(false);
  saving = signal(false);
  prices = readStorage<Record<string, number>>(this.pricesKey(), { ...DEFAULT_PRICES });
  form = this.emptyForm();

  clients = computed<ClientGroup[]>(() => {
    const groups = new Map<string, MonthlySubscription[]>();
    // Solo la mensualidad mas reciente de cada placa cuenta para el cliente.
    const latestByPlate = new Map<string, MonthlySubscription>();
    this.context.subscriptions().forEach(item => {
      const current = latestByPlate.get(item.plate);
      if (!current || item.expiresAt > current.expiresAt) latestByPlate.set(item.plate, item);
    });
    latestByPlate.forEach(item => {
      const key = (item.customerDocument || item.customerName).trim().toLowerCase();
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return [...groups.entries()].map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
      const latest = sorted[0];
      const types = [...new Set(items.map(item => item.vehicleType))];
      const typeText = types.length === 1 && items.length > 1
        ? `${vehicleMeta(types[0]).emoji} × ${items.length} ${vehicleMeta(types[0]).short}s`
        : types.map(type => `${vehicleMeta(type).emoji} ${vehicleMeta(type).short}`).join(' · ');
      return {
        key,
        name: latest.customerName,
        document: latest.customerDocument || 'Sin cédula',
        phone: latest.customerPhone || 'Sin celular',
        plates: items.map(item => displayPlate(item.plate)),
        typeText,
        amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        expiresAt: latest.expiresAt,
        days: daysUntil(latest.expiresAt),
        latest
      };
    }).sort((a, b) => (a.days < 0 ? 1 : 0) - (b.days < 0 ? 1 : 0) || a.days - b.days);
  });
  activeClients = computed(() => this.clients().filter(client => client.days >= 0));
  expiringClients = computed(() => this.activeClients().filter(client => client.days <= 10));
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

  openNew() {
    this.form = this.emptyForm();
    this.renewing.set(false);
    this.modalOpen.set(true);
  }

  renew(client: ClientGroup) {
    const subscription = client.latest;
    const nextStart = client.days >= 0 ? parseDateKey(subscription.expiresAt) : new Date();
    this.form = {
      ...this.emptyForm(),
      customerName: subscription.customerName,
      customerDocument: subscription.customerDocument || '',
      customerPhone: subscription.customerPhone || '',
      plate: displayPlate(subscription.plate),
      vehicleType: subscription.vehicleType,
      amount: Number(subscription.amount) || this.prices[subscription.vehicleType] || 0,
      startsAt: dateKey(nextStart)
    };
    this.renewing.set(true);
    this.modalOpen.set(true);
  }

  closeModal() {
    if (!this.saving()) this.modalOpen.set(false);
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
    return `${vehicleMeta(type).emoji} ${vehicleMeta(type).short} — ${money(this.prices[type] || 0)}/mes`;
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
      startsAt: this.form.startsAt,
      months: Number(this.form.months) || 1
    }, tenantHeaders(this.tenantId)).subscribe({
      next: subscription => {
        this.prices = { ...this.prices, [subscription.vehicleType]: Number(this.form.amount) };
        writeStorage(this.pricesKey(), this.prices);
        this.context.addSubscription(subscription);
        this.registerPayment(subscription);
      },
      error: err => {
        this.toast.err(err?.error?.message || 'No se pudo registrar la mensualidad');
        this.saving.set(false);
      }
    });
  }

  remind(client: ClientGroup) {
    const text = [
      `Hola ${client.name.split(' ')[0]} 👋`,
      `Te recordamos que tu mensualidad en ${this.context.parkingName()} para ${client.plates.join(', ')} vence el ${shortDate(client.expiresAt)}.`,
      'Renuévala para seguir disfrutando tu espacio. ¡Gracias! 🅿️'
    ].join('\n');
    window.open(whatsappUrl(client.latest.customerPhone, text), '_blank');
    this.toast.ok(`Recordatorio enviado a ${client.name.split(' ')[0]} por WhatsApp`, '📲');
  }

  daysClass(days: number) { return days <= 3 ? 'exp' : days <= 10 ? 'warn' : 'ok'; }
  shortDate = shortDate;
  money = money;

  private registerPayment(subscription: MonthlySubscription) {
    this.http.post(`${API.payment}/payments`, {
      ticketUuid: subscription.uuid,
      amount: subscription.amount,
      method: subscription.paymentMethod || this.form.paymentMethod
    }, tenantHeaders(this.tenantId)).subscribe({
      next: () => {
        this.toast.ok('Mensualidad registrada y pago ingresado a caja');
        this.sendWelcome(subscription);
        this.saving.set(false);
        this.modalOpen.set(false);
      },
      error: () => {
        this.toast.err('La mensualidad se creó, pero el pago no entró a caja');
        this.saving.set(false);
        this.modalOpen.set(false);
      }
    });
  }

  private sendWelcome(subscription: MonthlySubscription) {
    if (!subscription.customerPhone) return;
    const text = [
      '🅿️ *SP Parqueaderos*',
      `Mensualidad registrada en ${this.context.parkingName()}`,
      `Placa: ${displayPlate(subscription.plate)}`,
      `Vigencia: ${shortDate(subscription.startsAt)} al ${shortDate(subscription.expiresAt)}`,
      `Valor: ${money(subscription.amount)}`
    ].join('\n');
    window.setTimeout(() => this.toast.info('Abre WhatsApp para enviar la confirmación al cliente', '📲'), 800);
    this.lastWelcome.set(whatsappUrl(subscription.customerPhone, text));
  }

  lastWelcome = signal('');

  private emptyForm() {
    return {
      customerName: '',
      customerDocument: '',
      customerPhone: '',
      plate: '',
      vehicleType: 'CAR',
      amount: this.prices?.['CAR'] ?? DEFAULT_PRICES['CAR'],
      paymentMethod: 'CASH',
      startsAt: dateKey(new Date()),
      months: 1
    };
  }

  private pricesKey() { return `sp_monthly_prices_${tenantIdFromRoute(this.route)}`; }
}
