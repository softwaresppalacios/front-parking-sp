import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Ticket } from '../../../core/models';
import { money, tenantHeaders, tenantIdFromRoute, vehicleLabel } from '../../../core/utils';

@Component({
  selector: 'dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.component.html'
})
export class DashboardPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  tenantId = tenantIdFromRoute(this.route);
  summary = signal<any>(null);
  tickets = signal<Ticket[]>([]);

  constructor() { this.reload(); }

  reload() {
    this.http.get(`${API.reporting}/dashboards/current`, tenantHeaders(this.tenantId)).subscribe({ next: v => this.summary.set(v), error: () => this.summary.set({}) });
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, tenantHeaders(this.tenantId)).subscribe({ next: v => this.tickets.set(v), error: () => this.tickets.set([]) });
  }

  label(type: string) { return vehicleLabel(type); }
  money(v: number) { return money(v); }
}
