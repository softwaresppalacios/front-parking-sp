import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, roleLabel } from '../../core/auth/auth.service';
import { ParkingContextService } from '../../core/state/parking-context.service';
import { initials } from '../../core/utils';

@Component({
  selector: 'parking-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './parking-sidebar.component.html'
})
export class ParkingSidebarComponent {
  private auth = inject(AuthService);
  context = inject(ParkingContextService);
  initials = initials;
  userName = computed(() => this.auth.user()?.fullName || 'Usuario');
  role = computed(() => roleLabel(this.auth.role(this.context.tenantId())));
  canManage = computed(() => this.auth.canManage(this.context.tenantId()));

  logout() {
    this.auth.logout();
  }
}
