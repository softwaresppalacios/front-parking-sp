import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { API } from '../../../core/api/api.config';
import { BranchConfiguration, PricingCatalog, PricingRule, Tenant } from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';
import { normalizeAmount, sortSchedules } from '../../../core/utils';

@Injectable()
export class ConfigStore {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
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
  savingPricingRules = signal(false);

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
    this.branchConfig.update(config => this.normalizeBranchConfig({ ...config, [field]: Number(value) || 0 }));
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
    this.updateBranchConfiguration(this.savingBranch, this.branchMessage, 'Configuracion de la sede guardada correctamente.', 'Sede guardada');
  }

  saveResources() {
    this.updateBranchConfiguration(this.savingResources, this.resourcesMessage, 'Recursos del parqueadero guardados correctamente.', 'Recursos guardados');
  }

  saveSchedule() {
    this.updateBranchConfiguration(this.savingSchedule, this.scheduleMessage, 'Disponibilidad semanal guardada correctamente.', 'Horario guardado');
  }

  saveRule(rule: PricingRule) {
    this.savingRule.set(rule.vehicleType);
    this.pricingMessage.set('');
    this.http.put<PricingRule>(
      `${API.pricing}/pricing/rules/${rule.vehicleType}`,
      this.pricingRuleBody(rule),
      { headers: new HttpHeaders({ 'X-Tenant-Id': this.tenantId() }) }
    ).subscribe({
      next: saved => {
        this.pricingRules.update(items => items.map(item => item.vehicleType === saved.vehicleType ? { ...saved } : item));
        this.pricingMessage.set(`Tarifa ${saved.displayName} guardada.`);
        this.toast.success('Tarifa guardada', `La regla de ${saved.displayName} fue actualizada con exito.`);
        this.savingRule.set('');
      },
      error: err => {
        const message = err?.error?.message || 'No se pudo guardar la tarifa.';
        this.pricingMessage.set(message);
        this.toast.error('No se guardo la tarifa', message);
        this.savingRule.set('');
      }
    });
  }

  savePricingRules() {
    const rules = this.pricingRules();
    if (!rules.length || this.savingPricingRules()) return;
    this.savingPricingRules.set(true);
    this.pricingMessage.set('');
    forkJoin(rules.map(rule => this.http.put<PricingRule>(
      `${API.pricing}/pricing/rules/${rule.vehicleType}`,
      this.pricingRuleBody(rule),
      { headers: new HttpHeaders({ 'X-Tenant-Id': this.tenantId() }) }
    ))).subscribe({
      next: savedRules => {
        this.pricingRules.set(savedRules.map(rule => ({ ...rule })));
        this.pricingMessage.set('Reglas de cobro guardadas correctamente.');
        this.toast.success('Reglas guardadas', 'Las reglas de cobro fueron actualizadas con exito.');
        this.savingPricingRules.set(false);
      },
      error: err => {
        const message = err?.error?.message || 'No se pudieron guardar las reglas de cobro.';
        this.pricingMessage.set(message);
        this.toast.error('No se guardaron las reglas', message);
        this.savingPricingRules.set(false);
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
        this.branchConfig.set(this.normalizeBranchConfig(config));
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
    successMessage: string,
    successTitle: string
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
      manageResources: this.hasConfiguredResources() || this.branchConfig().manageResources,
      schedules: this.branchConfig().schedules.map(item => ({
        dayOfWeek: item.dayOfWeek,
        openTime: item.closed ? null : item.openTime,
        closeTime: item.closed ? null : item.closeTime,
        closed: item.closed
      }))
    };
    this.http.put<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId()}/branches/${this.branchUuid()}/configuration`, body).subscribe({
      next: config => {
        this.branchConfig.set(this.normalizeBranchConfig(config));
        messageState.set(successMessage);
        this.toast.success(successTitle, successMessage);
        savingState.set(false);
      },
      error: err => {
        const message = err?.error?.message || 'No se pudo guardar la configuracion.';
        messageState.set(message);
        this.toast.error('No se guardo la configuracion', message);
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

  private pricingRuleBody(rule: PricingRule) {
    const hourlyAmount = normalizeAmount(rule.hourlyAmount);
    const additionalHourAmount = normalizeAmount(rule.additionalHourAmount);
    const flatAmount = normalizeAmount(rule.flatAmount);

    return {
      vehicleType: rule.vehicleType,
      displayName: rule.displayName,
      pricingModel: rule.pricingModel,
      flatAmount: rule.pricingModel === 'FLAT' ? flatAmount : null,
      hourlyAmount: rule.pricingModel === 'PROGRESSIVE' ? hourlyAmount : null,
      additionalHourAmount: rule.pricingModel === 'PROGRESSIVE' ? additionalHourAmount : null,
      fractionAmount: rule.pricingModel === 'PROGRESSIVE' ? additionalHourAmount : null,
      fractionMinutes: rule.pricingModel === 'PROGRESSIVE' ? 60 : Number(rule.fractionMinutes) || 60,
      dayAmount: null,
      applyDailyCap: false,
      rateIncreaseAfterHours: null,
      rateIncreaseAmount: null,
      lostTicketFee: normalizeAmount(rule.lostTicketFee),
      active: rule.active
    };
  }

  private normalizeBranchConfig(config: BranchConfiguration): BranchConfiguration {
    const normalized = {
      ...config,
      carCapacity: Number(config.carCapacity) || 0,
      motorcycleCapacity: Number(config.motorcycleCapacity) || 0,
      keyRackCapacity: Number(config.keyRackCapacity) || 0,
      helmetLockerCapacity: Number(config.helmetLockerCapacity) || 0,
      schedules: sortSchedules(config.schedules || [])
    };

    return {
      ...normalized,
      manageResources: normalized.manageResources || this.hasConfiguredResources(normalized)
    };
  }

  private hasConfiguredResources(config = this.branchConfig()) {
    return [
      config.carCapacity,
      config.motorcycleCapacity,
      config.keyRackCapacity,
      config.helmetLockerCapacity
    ].some(value => (Number(value) || 0) > 0);
  }
}
