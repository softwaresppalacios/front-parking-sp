import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, WritableSignal, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { BranchConfiguration, PricingRule, Schedule } from '../../../core/models';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import { dayLabel, money, normalizeAmount, tenantHeaders, tenantIdFromRoute, vehicleMeta } from '../../../core/utils';

@Component({
  selector: 'config-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-page.component.html'
})
export class ConfigPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);

  draft = signal<BranchConfiguration | null>(null);
  savingBranch = signal(false);
  savingSchedule = signal(false);
  editing = signal<PricingRule | null>(null);
  savingRule = signal(false);

  constructor() {
    // Copia editable de la configuracion de la sede cada vez que llega del backend.
    effect(() => {
      const branch = this.context.branch();
      untracked(() => this.draft.set(branch ? this.clone(branch) : null));
    }, { allowSignalWrites: true });
  }

  setField<K extends keyof BranchConfiguration>(field: K, value: BranchConfiguration[K]) {
    this.draft.update(config => config ? { ...config, [field]: value } : config);
  }

  setNumber(field: 'carCapacity' | 'motorcycleCapacity' | 'keyRackCapacity' | 'helmetLockerCapacity', value: string | number) {
    this.setField(field, Math.max(0, Math.floor(Number(value) || 0)));
  }

  setSchedule(index: number, patch: Partial<Schedule>) {
    this.draft.update(config => {
      if (!config) return config;
      const schedules = config.schedules.map((item, current) => current === index ? { ...item, ...patch } : item);
      return { ...config, schedules };
    });
  }

  toggleDay(index: number, open: boolean) {
    const item = this.draft()?.schedules[index];
    if (!item) return;
    this.setSchedule(index, {
      closed: !open,
      openTime: open ? (item.openTime || '06:00') : item.openTime,
      closeTime: open ? (item.closeTime || '22:00') : item.closeTime
    });
  }

  saveBranch() {
    const config = this.draft();
    if (!config) return;
    if (!config.name?.trim()) { this.toast.err('Ingrese el nombre del parqueadero'); return; }
    this.save(this.savingBranch, 'Datos del establecimiento guardados');
  }

  saveSchedule() {
    const invalid = this.draft()?.schedules.find(item => !item.closed && (!item.openTime || !item.closeTime || item.openTime >= item.closeTime));
    if (invalid) { this.toast.err(`Revise el horario del ${dayLabel(invalid.dayOfWeek).toLowerCase()}`); return; }
    this.save(this.savingSchedule, 'Horario de atención guardado');
  }

  editRule(rule: PricingRule) {
    this.editing.set({ ...rule });
  }

  saveRule() {
    const rule = this.editing();
    if (!rule) return;
    if (rule.pricingModel === 'FLAT' && !(Number(rule.flatAmount) > 0)) { this.toast.err('Ingrese el valor de la tarifa plana'); return; }
    if (rule.pricingModel === 'PROGRESSIVE' && !(Number(rule.hourlyAmount) > 0)) { this.toast.err('Ingrese el valor por hora'); return; }
    this.savingRule.set(true);
    this.http.put<PricingRule>(`${API.pricing}/pricing/rules/${rule.vehicleType}`, {
      vehicleType: rule.vehicleType,
      displayName: rule.displayName?.trim() || vehicleMeta(rule.vehicleType).label,
      pricingModel: rule.pricingModel,
      flatAmount: normalizeAmount(rule.flatAmount),
      hourlyAmount: normalizeAmount(rule.hourlyAmount),
      additionalHourAmount: normalizeAmount(rule.additionalHourAmount) ?? normalizeAmount(rule.hourlyAmount),
      fractionAmount: normalizeAmount(rule.fractionAmount) ?? 0,
      fractionMinutes: Number(rule.fractionMinutes) || 30,
      dayAmount: normalizeAmount(rule.dayAmount),
      applyDailyCap: !!rule.applyDailyCap,
      rateIncreaseAfterHours: normalizeAmount(rule.rateIncreaseAfterHours),
      rateIncreaseAmount: normalizeAmount(rule.rateIncreaseAmount),
      lostTicketFee: normalizeAmount(rule.lostTicketFee),
      active: rule.active !== false
    }, tenantHeaders(this.tenantId)).subscribe({
      next: saved => {
        this.context.setRule(saved);
        this.editing.set(null);
        this.savingRule.set(false);
        this.toast.ok(`Tarifa de ${saved.displayName} actualizada`);
      },
      error: err => {
        this.savingRule.set(false);
        this.toast.err(err?.error?.message || 'No se pudo guardar la tarifa');
      }
    });
  }

  patchRule(patch: Partial<PricingRule>) {
    this.editing.update(rule => rule ? { ...rule, ...patch } : rule);
  }

  fractionText(rule: PricingRule) {
    return rule.pricingModel === 'FLAT' ? 'Tarifa plana' : `${rule.fractionMinutes}min · ${money(rule.fractionAmount)}`;
  }

  plan() {
    const tenant = this.context.tenant();
    const used = tenant?.branches?.length || 0;
    const limit = Math.max(1, tenant?.branchLimit || 1);
    return { name: tenant?.planName || '—', active: tenant?.status === 'ACTIVE', used, limit, pct: Math.min(100, Math.round(used / limit * 100)) };
  }

  dayLabel = dayLabel;
  meta = vehicleMeta;
  money = money;

  private save(state: WritableSignal<boolean>, message: string) {
    const config = this.draft();
    const branchUuid = this.context.branchUuid();
    if (!config || !branchUuid) return;
    state.set(true);
    this.http.put<BranchConfiguration>(`${API.tenant}/tenants/${this.tenantId}/branches/${branchUuid}/configuration`, {
      name: config.name?.trim(),
      nit: config.nit,
      phone: config.phone,
      address: config.address,
      carCapacity: config.carCapacity,
      motorcycleCapacity: config.motorcycleCapacity,
      keyRackCapacity: config.keyRackCapacity,
      helmetLockerCapacity: config.helmetLockerCapacity,
      manageResources: config.manageResources,
      schedules: config.schedules.map(item => ({
        dayOfWeek: item.dayOfWeek,
        openTime: item.closed ? null : item.openTime,
        closeTime: item.closed ? null : item.closeTime,
        closed: item.closed
      }))
    }).subscribe({
      next: saved => {
        this.context.setBranch(saved);
        state.set(false);
        this.toast.ok(message);
      },
      error: err => {
        state.set(false);
        this.toast.err(err?.error?.message || 'No se pudo guardar la configuración');
      }
    });
  }

  private clone(config: BranchConfiguration): BranchConfiguration {
    return {
      ...config,
      schedules: config.schedules.map(item => ({
        ...item,
        openTime: item.openTime ? item.openTime.slice(0, 5) : null,
        closeTime: item.closeTime ? item.closeTime.slice(0, 5) : null
      }))
    };
  }
}
