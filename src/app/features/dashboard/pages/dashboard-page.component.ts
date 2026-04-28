import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { CashSummary, MonthlySubscription, Ticket } from '../../../core/models';
import { money, tenantHeaders, tenantIdFromRoute, vehicleLabel } from '../../../core/utils';

type ChartRow = { label: string; value: number };

@Component({
  selector: 'dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  tenantId = tenantIdFromRoute(this.route);
  summary = signal<any>(null);
  tickets = signal<Ticket[]>([]);
  recentTickets = signal<Ticket[]>([]);
  cash = signal<CashSummary | null>(null);
  subscriptions = signal<MonthlySubscription[]>([]);

  constructor() { this.reload(); }

  reload() {
    this.http.get(`${API.reporting}/dashboards/current`, tenantHeaders(this.tenantId)).subscribe({ next: v => this.summary.set(v), error: () => this.summary.set({}) });
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, tenantHeaders(this.tenantId)).subscribe({ next: v => this.tickets.set(v), error: () => this.tickets.set([]) });
    this.http.get<Ticket[]>(`${API.operation}/tickets/recent`, tenantHeaders(this.tenantId)).subscribe({ next: v => this.recentTickets.set(v), error: () => this.recentTickets.set([]) });
    this.http.get<CashSummary>(`${API.payment}/cash-sessions/current`, tenantHeaders(this.tenantId)).subscribe({ next: v => this.cash.set(v), error: () => this.cash.set(null) });
    this.http.get<MonthlySubscription[]>(`${API.operation}/monthly-subscriptions`, tenantHeaders(this.tenantId)).subscribe({ next: v => this.subscriptions.set(v), error: () => this.subscriptions.set([]) });
  }

  revenueByHour(): ChartRow[] {
    const rows = Array.from({ length: 12 }, (_, index) => ({ label: `${String(index + 7).padStart(2, '0')}:00`, value: 0 }));
    (this.cash()?.recentMovements || []).forEach(movement => {
      const hour = new Date(movement.paidAt).getHours();
      const row = rows.find(item => item.label.startsWith(String(hour).padStart(2, '0')));
      if (row) row.value += Number(movement.amount) || 0;
    });
    return rows;
  }

  entriesByDay(): ChartRow[] {
    const days = this.lastSevenDays();
    this.recentTickets().forEach(ticket => {
      const key = new Date(ticket.checkedInAt).toISOString().slice(0, 10);
      const row = days.find(item => item.key === key);
      if (row) row.value += 1;
    });
    return days.map(({ label, value }) => ({ label, value }));
  }

  entriesByType(): ChartRow[] {
    return ['CAR', 'MOTORCYCLE', 'HEAVY', 'BICYCLE'].map(type => ({
      label: this.label(type),
      value: this.recentTickets().filter(ticket => ticket.vehicleType === type).length
    }));
  }

  paidMonthlyCount() { return this.subscriptions().length; }
  activeMonthlyCount() { return this.subscriptions().filter(item => this.isActive(item)).length; }
  expiringMonthlyCount() { return this.expiringSubscriptions().length; }
  monthlyRevenue() { return this.subscriptions().reduce((total, item) => total + Number(item.amount || 0), 0); }

  expiringSubscriptions() {
    const now = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    return this.subscriptions()
      .filter(item => {
        const expires = new Date(`${item.expiresAt}T23:59:59`);
        return expires >= now && expires <= limit;
      })
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .slice(0, 5);
  }

  max(rows: ChartRow[]) { return Math.max(1, ...rows.map(row => row.value)); }
  barHeight(row: ChartRow, rows: ChartRow[]) { return `${Math.max(6, (row.value / this.max(rows)) * 100)}%`; }
  barWidth(row: ChartRow, rows: ChartRow[]) { return `${Math.max(4, (row.value / this.max(rows)) * 100)}%`; }
  label(type: string) { return vehicleLabel(type); }
  money(v: number) { return money(v); }

  private isActive(item: MonthlySubscription) {
    return item.active && new Date(`${item.expiresAt}T23:59:59`) >= new Date();
  }

  private lastSevenDays() {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
        value: 0
      };
    });
  }
}
