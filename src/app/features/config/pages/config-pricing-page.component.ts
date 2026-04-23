import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfigStore } from '../store/config.store';
import { money, vehicleLabel } from '../../../core/utils';

@Component({
  selector: 'config-pricing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './config-pricing-page.component.html'
})
export class ConfigPricingPageComponent {
  store = inject(ConfigStore);

  vehicleLabel(type: string) { return vehicleLabel(type); }
  money(value: number) { return money(value); }
}
