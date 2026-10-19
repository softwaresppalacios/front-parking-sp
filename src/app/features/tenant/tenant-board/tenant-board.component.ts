import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { AuthService, TenantAccess, roleLabel } from '../../../core/auth/auth.service';
import { Tenant } from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'tenant-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-board.component.html'
})
export class TenantBoardComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  creating = signal(false);
  newTenantName = '';
  newBranchAddress = '';
  roleLabel = roleLabel;

  constructor() {
    this.auth.refresh().subscribe();
  }

  createTenant() {
    if (!this.newTenantName.trim()) { this.toast.err('Ingrese el nombre del parqueadero'); return; }
    this.creating.set(true);
    this.http.post<Tenant>(`${API.tenant}/tenants`, { name: this.newTenantName.trim(), branchAddress: this.newBranchAddress.trim() || null })
      .subscribe({
        next: tenant => {
          this.toast.ok(`Parqueadero ${tenant.name} creado`);
          this.newTenantName = '';
          this.newBranchAddress = '';
          this.creating.set(false);
          this.auth.refresh().subscribe();
        },
        error: err => {
          this.toast.err(err?.error?.message || 'No se pudo crear el parqueadero');
          this.creating.set(false);
        }
      });
  }

  open(tenant: TenantAccess) { this.router.navigateByUrl(`/parking/${tenant.uuid}/dashboard`); }
  logout() { this.auth.logout(); }
}
