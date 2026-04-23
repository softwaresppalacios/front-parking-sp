import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Ticket } from '../../../core/models';
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
  tenantId = tenantIdFromRoute(this.route);
  plate = '';
  paymentMethod = 'CASH';
  found = signal<Ticket | null>(null);
  total = signal(0);

  onPlateChange(value: string) { this.plate = this.formatPlate(value); }

  search() {
    this.http.get<Ticket>(`${API.operation}/tickets/by-plate/${this.plate}`, tenantHeaders(this.tenantId)).subscribe(t => {
      this.found.set(t);
      if (t.monthlySubscription) { this.total.set(0); return; }
      this.http.post<{ total: number }>(`${API.pricing}/pricing/calculate`, { ticketUuid: t.uuid, vehicleType: t.vehicleType, checkedInAt: t.checkedInAt }, tenantHeaders(this.tenantId)).subscribe(p => this.total.set(p.total));
    });
  }

  checkOut() {
    const ticket = this.found();
    if (!ticket) return;
    this.http.post<Ticket>(`${API.operation}/tickets/${ticket.uuid}/check-out`, { amountDue: this.total() }, tenantHeaders(this.tenantId)).subscribe(done => {
      this.http.post(`${API.payment}/payments`, { ticketUuid: done.uuid, amount: this.total(), method: this.paymentMethod }, tenantHeaders(this.tenantId)).subscribe();
      this.found.set(null); this.plate = ''; this.total.set(0);
    });
  }

  money(v: number) { return money(v); }

  private formatPlate(value: string) {
    return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  }
}
