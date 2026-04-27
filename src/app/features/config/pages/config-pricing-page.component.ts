import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PricingRule } from '../../../core/models';
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

  modelLabel(rule: PricingRule) {
    return rule.pricingModel === 'FLAT' ? 'Tarifa plana' : 'Primera hora + adicionales';
  }

  ruleSummary(rule: PricingRule) {
    if (rule.pricingModel === 'FLAT') {
      return `Cobra ${this.money(rule.flatAmount || 0)} al salir.`;
    }
    return `${this.money(rule.hourlyAmount || 0)} primera hora y ${this.money(rule.additionalHourAmount || 0)} cada hora adicional.`;
  }

  onPricingModelChange(rule: PricingRule, model: PricingRule['pricingModel']) {
    rule.pricingModel = model;
    if (model === 'FLAT') {
      rule.flatAmount = rule.flatAmount || rule.dayAmount || rule.hourlyAmount || 0;
      return;
    }

    rule.hourlyAmount = rule.hourlyAmount || rule.flatAmount || 0;
    rule.additionalHourAmount = rule.additionalHourAmount || rule.hourlyAmount || 0;
    rule.fractionAmount = rule.additionalHourAmount;
    rule.fractionMinutes = 60;
  }
}
