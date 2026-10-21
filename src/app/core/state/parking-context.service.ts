import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API } from '../api/api.config';
import { BranchConfiguration, MonthlySubscription, PricingCatalog, PricingRule, Tenant } from '../models';
import { dayKey, daysUntil, sortSchedules, tenantHeaders, vehicleLabel } from '../utils';

/** Datos compartidos del parqueadero abierto: tenant, sede, tarifas y mensualidades. */
@Injectable({ providedIn: 'root' })
export class ParkingContextService {
  private http = inject(HttpClient);

  tenantId = signal('');
  tenant = signal<Tenant | null>(null);
  branch = signal<BranchConfiguration | null>(null);
  rules = signal<PricingRule[]>([]);
  subscriptions = signal<MonthlySubscription[]>([]);

  branchUuid = computed(() => this.branch()?.uuid || this.tenant()?.branches?.[0]?.uuid || '');
  manageResources = computed(() => this.branch()?.manageResources ?? true);
  parkingName = computed(() => this.branch()?.name || this.tenant()?.name || 'Parqueadero');
  activeSubscriptions = computed(() => this.subscriptions().filter(item => item.active && daysUntil(item.expiresAt) >= 0));
  expiringSubscriptions = computed(() => this.activeSubscriptions()
    .filter(item => daysUntil(item.expiresAt) <= 10)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)));
  todaySchedule = computed(() => this.branch()?.schedules?.find(item => item.dayOfWeek === dayKey(new Date())) || null);
  isOpenNow = computed(() => {
    const schedule = this.todaySchedule();
    if (!schedule) return true;
    if (schedule.closed || !schedule.openTime || !schedule.closeTime) return false;
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return current >= schedule.openTime.slice(0, 5) && current <= schedule.closeTime.slice(0, 5);
  });

  load(tenantId: string) {
    if (!tenantId || (tenantId === this.tenantId() && this.tenant())) return;
    this.tenantId.set(tenantId);
    this.tenant.set(null);
    this.branch.set(null);
    this.rules.set([]);
    this.subscriptions.set([]);
    this.refreshTenant();
    this.refreshRules();
    this.refreshSubscriptions();
  }

  refreshTenant() {
    this.http.get<Tenant[]>(`${API.tenant}/tenants`).subscribe({
      next: tenants => {
        const tenant = tenants.find(item => item.uuid === this.tenantId()) || null;
        this.tenant.set(tenant);
        const branchUuid = tenant?.branches?.[0]?.uuid;
        if (!branchUuid) return;
        this.http.get<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId()}/branches/${branchUuid}/configuration`).subscribe({
          next: config => this.setBranch(config),
          error: () => this.branch.set(null)
        });
      },
      error: () => this.tenant.set(null)
    });
  }

  refreshRules() {
    this.http.get<PricingCatalog>(`${API.pricing}/pricing/rules`, tenantHeaders(this.tenantId())).subscribe({
      next: response => this.rules.set(response.rules || []),
      error: () => this.rules.set([])
    });
  }

  refreshSubscriptions() {
    this.http.get<MonthlySubscription[]>(`${API.operation}/monthly-subscriptions`, tenantHeaders(this.tenantId())).subscribe({
      next: items => this.subscriptions.set(items || []),
      error: () => this.subscriptions.set([])
    });
  }

  setBranch(config: BranchConfiguration) {
    this.branch.set({
      ...config,
      carCapacity: Number(config.carCapacity) || 0,
      motorcycleCapacity: Number(config.motorcycleCapacity) || 0,
      keyRackCapacity: Number(config.keyRackCapacity) || 0,
      helmetLockerCapacity: Number(config.helmetLockerCapacity) || 0,
      manageResources: config.manageResources !== false,
      schedules: sortSchedules(config.schedules || [])
    });
  }

  setRule(rule: PricingRule) {
    this.rules.update(items => items.some(item => item.vehicleType === rule.vehicleType)
      ? items.map(item => item.vehicleType === rule.vehicleType ? rule : item)
      : [...items, rule]);
  }

  addSubscription(subscription: MonthlySubscription) {
    this.subscriptions.update(items => [subscription, ...items]);
  }

  /** Reemplaza una mensualidad editada, renovada o cancelada. */
  replaceSubscription(subscription: MonthlySubscription) {
    this.subscriptions.update(items => items.map(item => item.uuid === subscription.uuid ? subscription : item));
  }

  rule(type: string) {
    return this.rules().find(item => item.vehicleType === type);
  }

  vehicleName(type: string) {
    return this.rule(type)?.displayName || vehicleLabel(type);
  }

  activeSubscriptionFor(plate: string) {
    return this.activeSubscriptions().find(item => item.plate === plate);
  }
}
