import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { BranchConfiguration, PricingCatalog, PricingRule, Tenant } from '../../../core/models';
import { dayLabel, money, normalizeAmount, sortSchedules, tenantIdFromRoute, vehicleLabel } from '../../../core/utils';
import { ConfigSummaryCardComponent } from '../components/config-summary-card/config-summary-card.component';

@Component({
  selector: 'config-page-tailwind',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfigSummaryCardComponent],
  templateUrl: './config-page.component.html',
  styleUrls: ['./config-page.component.css']
})
export class ConfigPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  tenantId = tenantIdFromRoute(this.route);
  branchUuid = signal('');
  loading = signal(true);
  savingBranch = signal(false);
  savingRule = signal('');
  branchMessage = signal('');
  pricingMessage = signal('');
  branchConfig = signal<BranchConfiguration>({ id: 0, uuid: '', name: '', nit: '', phone: '', address: '', carCapacity: 0, motorcycleCapacity: 0, keyRackCapacity: 0, helmetLockerCapacity: 0, active: true, schedules: [] });
  pricingRules = signal<PricingRule[]>([]);

  summaryCards() {
    const config = this.branchConfig();
    return [
      {
        label: 'Capacidad carros',
        value: config.carCapacity,
        unit: 'puestos',
        icon: 'C',
        description: 'Espacios habilitados para vehiculos tipo carro.',
        badge: 'Operacion vehicular',
        accentBar: 'bg-gradient-to-r from-rose-500 via-red-500 to-orange-400',
        surface: 'bg-gradient-to-br from-white via-rose-50/85 to-orange-50/90',
        orb: 'bg-rose-200/70',
        iconWrap: 'border-rose-200/80 bg-white/80 text-rose-600',
        unitClass: 'text-rose-600',
        badgeClass: 'border-rose-200/80 bg-white/75 text-rose-700'
      },
      {
        label: 'Capacidad motos',
        value: config.motorcycleCapacity,
        unit: 'puestos',
        icon: 'M',
        description: 'Cupos disponibles para motos dentro de la sede.',
        badge: 'Alta rotacion',
        accentBar: 'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400',
        surface: 'bg-gradient-to-br from-white via-fuchsia-50/80 to-pink-50/90',
        orb: 'bg-pink-200/70',
        iconWrap: 'border-pink-200/80 bg-white/80 text-pink-600',
        unitClass: 'text-pink-600',
        badgeClass: 'border-pink-200/80 bg-white/75 text-pink-700'
      },
      {
        label: 'Tablero llaves',
        value: config.keyRackCapacity,
        unit: 'slots',
        icon: 'L',
        description: 'Capacidad total del tablero para custodia de llaves.',
        badge: 'Control interno',
        accentBar: 'bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400',
        surface: 'bg-gradient-to-br from-white via-sky-50/85 to-cyan-50/90',
        orb: 'bg-sky-200/75',
        iconWrap: 'border-sky-200/80 bg-white/80 text-sky-600',
        unitClass: 'text-sky-600',
        badgeClass: 'border-sky-200/80 bg-white/75 text-sky-700'
      },
      {
        label: 'Casilleros cascos',
        value: config.helmetLockerCapacity,
        unit: 'slots',
        icon: 'H',
        description: 'Espacios asignables para almacenamiento de cascos.',
        badge: 'Servicio cliente',
        accentBar: 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300',
        surface: 'bg-gradient-to-br from-white via-amber-50/85 to-yellow-50/90',
        orb: 'bg-amber-200/75',
        iconWrap: 'border-amber-200/80 bg-white/80 text-amber-600',
        unitClass: 'text-amber-600',
        badgeClass: 'border-amber-200/80 bg-white/75 text-amber-700'
      }
    ];
  }

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<Tenant[]>(`${API.tenant}/tenants`).subscribe({
      next: tenants => {
        const tenant = tenants.find(item => item.uuid === this.tenantId);
        const branch = tenant?.branches?.[0];
        if (!branch) {
          this.branchMessage.set('No se encontro una sede configurada para este parqueadero.');
          this.loading.set(false);
          return;
        }
        this.branchUuid.set(branch.uuid);
        this.loadBranchConfig();
        this.loadPricingRules();
      },
      error: () => {
        this.branchMessage.set('No se pudo cargar el parqueadero actual.');
        this.loading.set(false);
      }
    });
  }

  loadBranchConfig() {
    this.http.get<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId}/branches/${this.branchUuid()}/configuration`).subscribe({
      next: config => {
        this.branchConfig.set({ ...config, schedules: sortSchedules(config.schedules || []) });
        this.loading.set(false);
      },
      error: () => {
        this.branchMessage.set('No se pudo cargar la configuracion de la sede.');
        this.loading.set(false);
      }
    });
  }

  loadPricingRules() {
    this.http.get<PricingCatalog>(`${API.pricing}/pricing/rules`, { headers: new HttpHeaders({ 'X-Tenant-Id': this.tenantId }) }).subscribe({
      next: response => this.pricingRules.set(response.rules.map(rule => ({ ...rule }))),
      error: () => this.pricingMessage.set('No se pudieron cargar las tarifas.')
    });
  }

  patchBranch(field: keyof BranchConfiguration, value: string) {
    this.branchConfig.update(config => ({ ...config, [field]: value }));
  }

  patchNumber(field: keyof BranchConfiguration, value: string | number) {
    this.branchConfig.update(config => ({ ...config, [field]: Number(value) || 0 }));
  }

  toggleClosed(index: number, closed: boolean) {
    this.branchConfig.update(config => ({
      ...config,
      schedules: config.schedules.map((item, current) => current !== index ? item : { ...item, closed, openTime: closed ? null : item.openTime || '06:00', closeTime: closed ? null : item.closeTime || '22:00' })
    }));
  }

  saveBranch() {
    this.savingBranch.set(true);
    this.branchMessage.set('');
    const body = {
      name: this.branchConfig().name,
      nit: this.branchConfig().nit,
      phone: this.branchConfig().phone,
      address: this.branchConfig().address,
      carCapacity: this.branchConfig().carCapacity,
      motorcycleCapacity: this.branchConfig().motorcycleCapacity,
      keyRackCapacity: this.branchConfig().keyRackCapacity,
      helmetLockerCapacity: this.branchConfig().helmetLockerCapacity,
      schedules: this.branchConfig().schedules.map(item => ({ dayOfWeek: item.dayOfWeek, openTime: item.closed ? null : item.openTime, closeTime: item.closed ? null : item.closeTime, closed: item.closed }))
    };
    this.http.put<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId}/branches/${this.branchUuid()}/configuration`, body).subscribe({
      next: config => {
        this.branchConfig.set({ ...config, schedules: sortSchedules(config.schedules || []) });
        this.branchMessage.set('Cambios guardados correctamente.');
        this.savingBranch.set(false);
      },
      error: err => {
        this.branchMessage.set(err?.error?.message || 'No se pudo guardar la configuracion.');
        this.savingBranch.set(false);
      }
    });
  }

  saveRule(rule: PricingRule) {
    this.savingRule.set(rule.vehicleType);
    this.pricingMessage.set('');
    this.http.put<PricingRule>(`${API.pricing}/pricing/rules/${rule.vehicleType}`, {
      vehicleType: rule.vehicleType,
      displayName: rule.displayName,
      pricingModel: rule.pricingModel,
      flatAmount: normalizeAmount(rule.flatAmount),
      hourlyAmount: normalizeAmount(rule.hourlyAmount),
      additionalHourAmount: normalizeAmount(rule.additionalHourAmount),
      fractionAmount: normalizeAmount(rule.fractionAmount),
      fractionMinutes: Number(rule.fractionMinutes) || 30,
      dayAmount: normalizeAmount(rule.dayAmount),
      applyDailyCap: rule.applyDailyCap,
      rateIncreaseAfterHours: normalizeAmount(rule.rateIncreaseAfterHours),
      rateIncreaseAmount: normalizeAmount(rule.rateIncreaseAmount),
      lostTicketFee: normalizeAmount(rule.lostTicketFee),
      active: rule.active
    }, { headers: new HttpHeaders({ 'X-Tenant-Id': this.tenantId }) }).subscribe({
      next: saved => {
        this.pricingRules.update(items => items.map(item => item.vehicleType === saved.vehicleType ? { ...saved } : item));
        this.pricingMessage.set(`Tarifa ${saved.displayName} guardada.`);
        this.savingRule.set('');
      },
      error: err => {
        this.pricingMessage.set(err?.error?.message || 'No se pudo guardar la tarifa.');
        this.savingRule.set('');
      }
    });
  }

  dayLabel(day: string) { return dayLabel(day); }
  vehicleLabel(type: string) { return vehicleLabel(type); }
  money(v: number) { return money(v); }
}
