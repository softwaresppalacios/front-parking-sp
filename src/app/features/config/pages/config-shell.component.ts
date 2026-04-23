import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { tenantIdFromRoute } from '../../../core/utils';
import { ConfigStore } from '../store/config.store';

@Component({
  selector: 'config-shell-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  providers: [ConfigStore],
  templateUrl: './config-shell.component.html',
  styleUrls: ['./config-shell.component.css']
})
export class ConfigShellComponent {
  private route = inject(ActivatedRoute);
  store = inject(ConfigStore);

  constructor() {
    this.store.init(tenantIdFromRoute(this.route));
  }
}
