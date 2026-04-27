import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { MonthlySubscription, Ticket } from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';
import { money, tenantHeaders, tenantIdFromRoute, vehicleLabel } from '../../../core/utils';

@Component({
  selector: 'monthly-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monthly-page.component.html',
  styleUrls: ['./monthly-page.component.css']
})
export class MonthlyPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  tenantId = tenantIdFromRoute(this.route);
  tickets = signal<Ticket[]>([]);
  subscriptions = signal<MonthlySubscription[]>([]);
  saving = signal(false);
  modalOpen = signal(false);
  query = '';
  form = {
    customerName: '',
    customerDocument: '',
    customerPhone: '',
    plate: '',
    vehicleType: 'CAR',
    amount: 0,
    paymentMethod: 'CASH',
    startsAt: new Date().toISOString().slice(0, 10),
    months: 1
  };

  constructor() { this.load(); }

  load() {
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, tenantHeaders(this.tenantId)).subscribe({
      next: tickets => this.tickets.set(tickets),
      error: () => this.tickets.set([])
    });
    this.http.get<MonthlySubscription[]>(`${API.operation}/monthly-subscriptions`, tenantHeaders(this.tenantId)).subscribe({
      next: subscriptions => this.subscriptions.set(subscriptions),
      error: () => this.subscriptions.set([])
    });
  }

  create() {
    if (!this.form.customerName.trim() || !this.form.plate.trim() || !this.form.amount) {
      this.toast.error('Faltan datos', 'Ingresa comprador, placa y valor de la mensualidad.');
      return;
    }
    this.saving.set(true);
    this.http.post<MonthlySubscription>(`${API.operation}/monthly-subscriptions`, {
      ...this.form,
      plate: this.formatPlate(this.form.plate),
      amount: Number(this.form.amount) || 0,
      months: Number(this.form.months) || 1
    }, tenantHeaders(this.tenantId)).subscribe({
      next: subscription => {
        this.subscriptions.update(items => [subscription, ...items]);
        this.registerPayment(subscription);
      },
      error: err => {
        this.toast.error('No se registro la mensualidad', err?.error?.message || 'Revisa los datos e intenta de nuevo.');
        this.saving.set(false);
      }
    });
  }

  openModal() {
    this.modalOpen.set(true);
  }

  closeModal() {
    if (this.saving()) return;
    this.modalOpen.set(false);
  }

  monthlyTickets() { return this.tickets().filter(ticket => ticket.monthlySubscription); }
  filteredSubscriptions() {
    const query = this.query.trim().toUpperCase();
    return this.subscriptions().filter(item => !query || item.plate.includes(query) || item.customerName.toUpperCase().includes(query));
  }
  activeSubscriptions() { return this.subscriptions().filter(item => item.active && new Date(`${item.expiresAt}T23:59:59`) >= new Date()); }
  expiredSubscriptions() { return this.subscriptions().filter(item => new Date(`${item.expiresAt}T23:59:59`) < new Date()); }
  monthlyRevenue() { return this.subscriptions().reduce((total, item) => total + Number(item.amount || 0), 0); }
  countByType(type: string) { return this.activeSubscriptions().filter(item => item.vehicleType === type).length; }
  label(type: string) { return vehicleLabel(type); }
  money(value: number) { return money(value); }
  onPlateChange(value: string) { this.form.plate = this.formatPlate(value); }

  private resetForm() {
    this.form = {
      customerName: '',
      customerDocument: '',
      customerPhone: '',
      plate: '',
      vehicleType: 'CAR',
      amount: 0,
      paymentMethod: 'CASH',
      startsAt: new Date().toISOString().slice(0, 10),
      months: 1
    };
  }

  private formatPlate(value: string) {
    return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  }

  private registerPayment(subscription: MonthlySubscription) {
    this.http.post(`${API.payment}/payments`, {
      ticketUuid: subscription.uuid,
      amount: subscription.amount,
      method: subscription.paymentMethod || this.form.paymentMethod
    }, tenantHeaders(this.tenantId)).subscribe({
      next: () => {
        this.toast.success('Mensualidad registrada', `Pago de ${this.money(subscription.amount)} registrado para ${subscription.plate}.`);
        this.resetForm();
        this.modalOpen.set(false);
        this.saving.set(false);
      },
      error: () => {
        this.toast.error('Pago no registrado en caja', 'La mensualidad se creo, pero no entro al movimiento de caja.');
        this.resetForm();
        this.modalOpen.set(false);
        this.saving.set(false);
      }
    });
  }
}
