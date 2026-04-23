import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { BranchConfiguration, CashSummary, Tenant, Ticket } from '../../../core/models';
import { money, tenantHeaders, tenantIdFromRoute, vehicleLabel } from '../../../core/utils';

@Component({
  selector: 'reports-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.css']
})
export class ReportsPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  tenantId = tenantIdFromRoute(this.route);
  tickets = signal<Ticket[]>([]);
  cash = signal<CashSummary | null>(null);
  branchConfig = signal<BranchConfiguration | null>(null);

  constructor() { this.load(); }

  load() {
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, tenantHeaders(this.tenantId)).subscribe({ next: tickets => this.tickets.set(tickets), error: () => this.tickets.set([]) });
    this.http.get<CashSummary>(`${API.payment}/cash-sessions/current`, tenantHeaders(this.tenantId)).subscribe({ next: cash => this.cash.set(cash), error: () => this.cash.set(null) });
    this.http.get<Tenant[]>(`${API.tenant}/tenants`).subscribe({
      next: tenants => {
        const tenant = tenants.find(item => item.uuid === this.tenantId);
        const branch = tenant?.branches?.[0];
        if (!branch) return;
        this.http.get<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId}/branches/${branch.uuid}/configuration`).subscribe({
          next: config => this.branchConfig.set(config),
          error: () => this.branchConfig.set(null)
        });
      },
      error: () => this.branchConfig.set(null)
    });
  }

  occupancyRows() {
    const rows = [{ key: 'CAR', label: 'Carro' }, { key: 'MOTORCYCLE', label: 'Moto' }, { key: 'HEAVY', label: 'Carga pesada' }, { key: 'BICYCLE', label: 'Bicicleta' }];
    return rows.map(row => ({ label: row.label, active: this.tickets().filter(ticket => ticket.vehicleType === row.key).length, monthly: this.tickets().filter(ticket => ticket.vehicleType === row.key && ticket.monthlySubscription).length }));
  }
  carsInUse() { return this.tickets().filter(ticket => ['CAR', 'HEAVY', 'BICYCLE'].includes(ticket.vehicleType)).length; }
  motorcyclesInUse() { return this.tickets().filter(ticket => ticket.vehicleType === 'MOTORCYCLE').length; }
  keysInUse() { return this.tickets().filter(ticket => !!ticket.keySlotCode).length; }
  helmetsInUse() { return this.tickets().filter(ticket => !!ticket.helmetLockerCode).length; }
  available(total: number, used: number) { return Math.max(0, total - used); }
  label(type: string) { return vehicleLabel(type); }
  money(v: number) { return money(v); }
}
