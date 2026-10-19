import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { PricingCalculation, Ticket } from '../../../core/models';
import { LocalHistoryService } from '../../../core/state/local-history.service';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  amountBreakdown, cleanPlate, displayPlate, durationText, formatPlate, hhmm, minutesBetween, money, tenantHeaders, tenantIdFromRoute, vehicleMeta
} from '../../../core/utils';

@Component({
  selector: 'exit-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exit-page.component.html'
})
export class ExitPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private history = inject(LocalHistoryService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);

  search = '';
  paymentMethod = signal<'CASH' | 'DIGITAL'>('CASH');
  found = signal<Ticket | null>(null);
  total = signal(0);
  searching = signal(false);
  paying = signal(false);
  now = signal(new Date());
  activeTickets = signal<Ticket[]>([]);

  minutes = computed(() => this.found() ? minutesBetween(this.found()!.checkedInAt, this.now()) : 0);
  rule = computed(() => this.found() ? this.context.rule(this.found()!.vehicleType) : undefined);
  breakdown = computed(() => {
    const { base } = amountBreakdown(this.rule(), this.minutes());
    return { base, extra: Math.max(0, this.total() - base) };
  });
  latestActive = computed(() => this.activeTickets()[0] || null);

  private lastPricedMinute = -1;

  constructor() {
    this.loadActive();
    const timer = window.setInterval(() => {
      this.now.set(new Date());
      const ticket = this.found();
      // El total se recalcula con el pricing-service cada minuto mientras el vehiculo esta seleccionado.
      if (ticket && !this.paying() && Math.floor(this.minutes()) !== this.lastPricedMinute && new Date().getSeconds() === 0) {
        this.price(ticket).subscribe({ next: result => this.applyPrice(result), error: () => undefined });
      }
    }, 1000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));

    const plate = this.route.snapshot.queryParamMap.get('placa');
    if (plate) {
      this.search = formatPlate(plate);
      this.find();
    }
  }

  loadActive() {
    this.http.get<Ticket[]>(`${API.operation}/tickets/active`, tenantHeaders(this.tenantId)).subscribe({
      next: tickets => this.activeTickets.set(tickets),
      error: () => this.activeTickets.set([])
    });
  }

  onSearchChange(value: string) { this.search = formatPlate(value); }

  useLatest() {
    const ticket = this.latestActive();
    if (!ticket) return;
    this.search = displayPlate(ticket.plate);
    this.find();
  }

  find() {
    const plate = cleanPlate(this.search);
    if (!plate || plate.length < 5) { this.toast.err('Ingrese una placa válida'); return; }
    this.searching.set(true);
    this.http.get<Ticket>(`${API.operation}/tickets/by-plate/${plate}`, tenantHeaders(this.tenantId)).subscribe({
      next: ticket => {
        this.now.set(new Date());
        this.found.set(ticket);
        this.paymentMethod.set('CASH');
        this.search = displayPlate(ticket.plate);
        if (ticket.monthlySubscription) {
          this.total.set(0);
          this.searching.set(false);
          return;
        }
        this.price(ticket).subscribe({
          next: result => { this.applyPrice(result); this.searching.set(false); },
          error: () => { this.toast.err('No se pudo calcular la tarifa de este vehículo'); this.searching.set(false); }
        });
      },
      error: err => {
        this.found.set(null);
        this.searching.set(false);
        this.toast.err(err?.status === 404 ? `No hay un vehículo adentro con placa ${displayPlate(plate)}` : 'No se pudo consultar el vehículo');
      }
    });
  }

  confirm() {
    const ticket = this.found();
    if (!ticket || this.paying()) return;
    this.paying.set(true);
    if (ticket.monthlySubscription) {
      this.checkOut(ticket, 0);
      return;
    }
    this.price(ticket).subscribe({
      next: result => { this.applyPrice(result); this.checkOut(ticket, this.total()); },
      error: () => { this.toast.err('No se pudo calcular la tarifa de este vehículo'); this.paying.set(false); }
    });
  }

  cancel() {
    this.found.set(null);
    this.search = '';
  }

  elapsedText() { return durationText(this.minutes()); }
  rateText() {
    const rule = this.rule();
    if (!rule) return '—';
    return rule.pricingModel === 'FLAT' ? `${money(rule.flatAmount)} tarifa plana` : `${money(rule.hourlyAmount)}/hr`;
  }
  extraLabel() {
    const rule = this.rule();
    if (!rule || rule.pricingModel === 'FLAT') return 'Adicionales';
    return `Horas adicionales y fracciones (${rule.fractionMinutes}min)`;
  }
  methodLabel() { return this.paymentMethod() === 'CASH' ? 'Efectivo' : 'Pago Digital'; }

  meta = vehicleMeta;
  money = money;
  hhmm = hhmm;
  plate = displayPlate;

  private price(ticket: Ticket) {
    return this.http.post<PricingCalculation>(
      `${API.pricing}/pricing/calculate`,
      { ticketUuid: ticket.uuid, vehicleType: ticket.vehicleType, checkedInAt: ticket.checkedInAt },
      tenantHeaders(this.tenantId)
    );
  }

  private applyPrice(result: PricingCalculation) {
    this.total.set(Number(result.total) || 0);
    this.lastPricedMinute = Math.floor(this.minutes());
  }

  private checkOut(ticket: Ticket, amount: number) {
    const method = this.paymentMethod();
    this.http.post<Ticket>(`${API.operation}/tickets/${ticket.uuid}/check-out`, { amountDue: amount }, tenantHeaders(this.tenantId)).subscribe({
      next: closed => {
        this.history.recordPayment(this.tenantId, closed, method);
        const released = [closed.spaceCode && `Slot ${closed.spaceCode}`, closed.keySlotCode && `tablero ${closed.keySlotCode}`, closed.helmetLockerCode && `casillero ${closed.helmetLockerCode}`]
          .filter(Boolean).join(' y ');
        const finish = () => {
          this.toast.ok(`Salida de ${displayPlate(closed.plate)} registrada. Cobro: ${money(amount)}`);
          if (released) window.setTimeout(() => this.toast.info(`${released} liberados`, '🔓'), 1000);
          this.found.set(null);
          this.search = '';
          this.total.set(0);
          this.paying.set(false);
          this.loadActive();
        };
        if (closed.monthlySubscription || amount <= 0) { finish(); return; }
        this.http.post(`${API.payment}/payments`, { ticketUuid: closed.uuid, amount, method }, tenantHeaders(this.tenantId)).subscribe({
          next: finish,
          error: () => {
            this.toast.err('La salida se registró, pero el pago no entró a caja');
            this.found.set(null);
            this.paying.set(false);
          }
        });
      },
      error: () => {
        this.toast.err('No se pudo registrar la salida del vehículo');
        this.paying.set(false);
      }
    });
  }
}
