import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Ticket } from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';
import { money, tenantHeaders, tenantIdFromRoute } from '../../../core/utils';

@Component({
  selector: 'exit-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exit-page.component.html'
})
export class ExitPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  tenantId = tenantIdFromRoute(this.route);
  plate = '';
  paymentMethod = 'CASH';
  found = signal<Ticket | null>(null);
  total = signal(0);
  calculating = signal(false);
  paying = signal(false);
  message = signal('');
  error = signal('');

  onPlateChange(value: string) { this.plate = this.formatPlate(value); }

  search() {
    this.message.set('');
    this.error.set('');
    this.found.set(null);
    this.total.set(0);
    if (!this.plate) {
      this.error.set('Ingrese una placa para buscar.');
      return;
    }
    this.calculating.set(true);
    this.http.get<Ticket>(`${API.operation}/tickets/by-plate/${this.plate}`, tenantHeaders(this.tenantId)).subscribe(t => {
      this.found.set(t);
      this.refreshTotal(t, () => this.calculating.set(false));
    }, () => {
      this.error.set('No se encontro un ticket activo para esta placa.');
      this.calculating.set(false);
    });
  }

  checkOut() {
    const ticket = this.found();
    if (!ticket || this.paying()) return;
    this.message.set('');
    this.error.set('');
    this.paying.set(true);
    this.refreshTotal(ticket, amount => this.registerExitAndPayment(ticket, amount));
  }

  private refreshTotal(ticket: Ticket, done: (amount: number) => void) {
    if (ticket.monthlySubscription) {
      this.total.set(0);
      done(0);
      return;
    }
    this.http.post<{ total: number }>(
      `${API.pricing}/pricing/calculate`,
      { ticketUuid: ticket.uuid, vehicleType: ticket.vehicleType, checkedInAt: ticket.checkedInAt },
      tenantHeaders(this.tenantId)
    ).subscribe({
      next: pricing => {
        const amount = Number(pricing.total) || 0;
        this.total.set(amount);
        done(amount);
      },
      error: () => {
        this.error.set('No se pudo calcular la tarifa configurada para este vehiculo.');
        this.calculating.set(false);
        this.paying.set(false);
      }
    });
  }

  private registerExitAndPayment(ticket: Ticket, amount: number) {
    this.http.post<Ticket>(`${API.operation}/tickets/${ticket.uuid}/check-out`, { amountDue: amount }, tenantHeaders(this.tenantId)).subscribe({
      next: done => {
        this.http.post<{ paidAt: string }>(
          `${API.payment}/payments`,
          { ticketUuid: done.uuid, amount, method: this.paymentMethod },
          tenantHeaders(this.tenantId)
        ).subscribe({
          next: () => {
            this.message.set(`Pago realizado con exito por ${this.money(amount)}.`);
            this.toast.success('Pago realizado', `Se registro el pago por ${this.money(amount)} con exito.`);
            this.found.set(null);
            this.plate = '';
            this.total.set(0);
            this.paying.set(false);
          },
          error: () => {
            this.error.set('La salida se registro, pero no se pudo registrar el pago.');
            this.toast.error('Pago no registrado', 'La salida se registro, pero el pago no pudo completarse.');
            this.paying.set(false);
          }
        });
      },
      error: () => {
        this.error.set('No se pudo registrar la salida del vehiculo.');
        this.toast.error('Salida no registrada', 'No se pudo completar la salida del vehiculo.');
        this.paying.set(false);
      }
    });
  }

  money(v: number) { return money(v); }

  private formatPlate(value: string) {
    return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  }
}
