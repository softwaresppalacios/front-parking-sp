import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Tenant } from '../../../core/models';

@Component({
  selector: 'tenant-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-board.component.html'
})
export class TenantBoardComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  tenants = signal<Tenant[]>([]);
  newTenantName = '';
  newBranchAddress = '';

  constructor() { this.load(); }

  load() {
    this.http.get<Tenant[]>(`${API.tenant}/tenants`).subscribe(v => this.tenants.set(v));
  }

  createTenant() {
    if (!this.newTenantName.trim()) return;
    this.http.post<Tenant>(`${API.tenant}/tenants`, { name: this.newTenantName, branchAddress: this.newBranchAddress || 'Sede principal' })
      .subscribe(t => {
        this.tenants.update(all => [t, ...all]);
        this.newTenantName = '';
        this.newBranchAddress = '';
      });
  }

  open(tenant: Tenant) { this.router.navigateByUrl(`/parking/${tenant.uuid}/dashboard`); }
  logout() { localStorage.removeItem('sp_session'); this.router.navigateByUrl('/login'); }
}
