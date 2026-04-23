import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { CashSummary } from '../../../core/models';
import { money, tenantHeaders, tenantIdFromRoute } from '../../../core/utils';

@Component({
  selector: 'cash-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cash-page.component.html'
})
export class CashPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  tenantId = tenantIdFromRoute(this.route);
  summary = signal<CashSummary | null>(null);

  constructor() { this.load(); }

  load() { this.http.get<CashSummary>(`${API.payment}/cash-sessions/current`, tenantHeaders(this.tenantId)).subscribe(v => this.summary.set(v)); }
  money(v: number) { return money(v); }
}
