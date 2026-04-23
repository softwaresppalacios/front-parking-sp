import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Ticket } from '../../../core/models';
import { tenantHeaders, tenantIdFromRoute, vehicleLabel } from '../../../core/utils';

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
  tenantId = tenantIdFromRoute(this.route);
  tickets = signal<Ticket[]>([]);
  query = '';

  constructor() { this.load(); }

  load() {
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, tenantHeaders(this.tenantId)).subscribe({
      next: tickets => this.tickets.set(tickets),
      error: () => this.tickets.set([])
    });
  }

  monthlyTickets() { return this.tickets().filter(ticket => ticket.monthlySubscription); }
  filteredMonthlyTickets() { const query = this.query.trim().toUpperCase(); return this.monthlyTickets().filter(ticket => !query || ticket.plate.includes(query)); }
  nonMonthlyTickets() { return this.tickets().filter(ticket => !ticket.monthlySubscription); }
  countByType(type: string) { return this.monthlyTickets().filter(ticket => ticket.vehicleType === type).length; }
  otherMonthlyCount() { return this.monthlyTickets().filter(ticket => !['CAR', 'MOTORCYCLE'].includes(ticket.vehicleType)).length; }
  label(type: string) { return vehicleLabel(type); }
}
