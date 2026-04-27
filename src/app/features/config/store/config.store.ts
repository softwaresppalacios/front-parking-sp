import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { API } from '../../../core/api/api.config';
import { BranchConfiguration, PricingCatalog, PricingRule, Tenant } from '../../../core/models';
import { normalizeAmount, sortSchedules } from '../../../core/utils';

@Injectable()
export class ConfigStore {
  private http = inject(HttpClient);
  private initializedTenantId = '';

  tenantId = signal('');
  branchUuid = signal('');
  loading = signal(true);
  branchConfig = signal<BranchConfiguration>({
    id: 0,
    uuid: '',
    name: '',
    nit: '',
    phone: '',
    address: '',
    carCapacity: 0,
    motorcycleCapacity: 0,
    keyRackCapacity: 0,
    helmetLockerCapacity: 0,
    manageResources: true,
    active: true,
    schedules: []
  });
  pricingRules = signal<PricingRule[]>([]);

  branchMessage = signal('');
  resourcesMessage = signal('');
  scheduleMessage = signal('');
  pricingMessage = signal('');

  savingBranch = signal(false);
  savingResources = signal(false);
  savingSchedule = signal(false);
  savingRule = signal('');

  openDays = computed(() => this.branchConfig().schedules.filter(day => !day.closed).length);
  closedDays = computed(() => this.branchConfig().schedules.filter(day => day.closed).length);

  init(tenantId: string) {
    if (!tenantId) return;
    if (this.initializedTenantId === tenantId && !this.loading()) return;
    this.initializedTenantId = tenantId;
    this.tenantId.set(tenantId);
    this.load();
  }

  patchBranch(field: keyof BranchConfiguration, value: string | number | boolean | null) {
    this.branchConfig.update(config => ({ ...config, [field]: value }));
  }

  patchNumber(field: keyof BranchConfiguration, value: string | number) {
    this.branchConfig.update(config => ({ ...config, [field]: Number(value) || 0 }));
  }

  toggleClosed(index: number, closed: boolean) {
    this.branchConfig.update(config => ({
      ...config,
      schedules: config.schedules.map((item, current) => current !== index ? item : {
        ...item,
        closed,
        openTime: closed ? null : item.openTime || '06:00',
        closeTime: closed ? null : item.closeTime || '22:00'
      })
    }));
  }

  saveBranchDetails() {
    this.updateBranchConfiguration(this.savingBranch, this.branchMessage, 'Configuracion de la sede guardada correctamente.');
  }

  saveResources() {
    this.updateBranchConfiguration(this.savingResources, this.resourcesMessage, 'Recursos del parqueadero guardados correctamente.');
  }

  saveSchedule() {
    this.updateBranchConfiguration(this.savingSchedule, this.scheduleMessage, 'Disponibilidad semanal guardada correctamente.');
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
    }, { headers: new HttpHeaders({ 'X-Tenant-Id': this.tenantId() }) }).subscribe({
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

  private load() {
    this.loading.set(true);
    this.clearMessages();
    this.http.get<Tenant[]>(`${API.tenant}/tenants`).subscribe({
      next: tenants => {
        const tenant = tenants.find(item => item.uuid === this.tenantId());
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

  private loadBranchConfig() {
    this.http.get<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId()}/branches/${this.branchUuid()}/configuration`).subscribe({
      next: config => {
        this.branchConfig.set({
          ...config,
          manageResources: config.manageResources ?? true,
          schedules: sortSchedules(config.schedules || [])
        });
        this.loading.set(false);
      },
      error: () => {
        this.branchMessage.set('No se pudo cargar la configuracion de la sede.');
        this.loading.set(false);
      }
    });
  }

  private loadPricingRules() {
    this.http.get<PricingCatalog>(`${API.pricing}/pricing/rules`, { headers: new HttpHeaders({ 'X-Tenant-Id': this.tenantId() }) }).subscribe({
      next: response => this.pricingRules.set(response.rules.map(rule => ({ ...rule }))),
      error: () => this.pricingMessage.set('No se pudieron cargar las tarifas.')
    });
  }

  private updateBranchConfiguration(
    savingState: WritableSignal<boolean>,
    messageState: WritableSignal<string>,
    successMessage: string
  ) {
    savingState.set(true);
    messageState.set('');
    const body = {
      name: this.branchConfig().name,
      nit: this.branchConfig().nit,
      phone: this.branchConfig().phone,
      address: this.branchConfig().address,
      carCapacity: this.branchConfig().carCapacity,
      motorcycleCapacity: this.branchConfig().motorcycleCapacity,
      keyRackCapacity: this.branchConfig().keyRackCapacity,
      helmetLockerCapacity: this.branchConfig().helmetLockerCapacity,
      manageResources: this.branchConfig().manageResources,
      schedules: this.branchConfig().schedules.map(item => ({
        dayOfWeek: item.dayOfWeek,
        openTime: item.closed ? null : item.openTime,
        closeTime: item.closed ? null : item.closeTime,
        closed: item.closed
      }))
    };
    this.http.put<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId()}/branches/${this.branchUuid()}/configuration`, body).subscribe({
      next: config => {
        this.branchConfig.set({ ...config, schedules: sortSchedules(config.schedules || []) });
        messageState.set(successMessage);
        savingState.set(false);
      },
      error: err => {
        messageState.set(err?.error?.message || 'No se pudo guardar la configuracion.');
        savingState.set(false);
      }
    });
  }

  private clearMessages() {
    this.branchMessage.set('');
    this.resourcesMessage.set('');
    this.scheduleMessage.set('');
    this.pricingMessage.set('');
  }
}
