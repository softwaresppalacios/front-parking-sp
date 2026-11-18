import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { PaymentMethod, PricingCalculation, Ticket } from '../../../core/models';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { TicketPrinterService } from '../../../core/ui/ticket-printer.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  apiErrorMessage, cleanPlate, estimateCharge, helmetLockersOf, displayPlate, durationText, formatPlate, hhmm, minutesBetween, money, paymentMethodMeta, tenantHeaders, tenantIdFromRoute, vehicleMeta
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
  private printer = inject(TicketPrinterService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);

  search = '';
  paymentMethod = signal<PaymentMethod>('CASH');
  /** Comprobante del pago en linea (opcional). */
  onlineReference = '';
  found = signal<Ticket | null>(null);
  total = signal(0);
  /** Descuento de monto exacto en pesos (no porcentaje). El servidor valida que no supere el total. */
  discount = signal(0);
  discountReason = '';
  showDiscount = signal(false);
  /** Lo que se cobra: total de la tarifa menos el descuento. */
  payable = computed(() => Math.max(0, this.total() - this.discount()));
  searching = signal(false);
  paying = signal(false);
  now = signal(new Date());
  activeTickets = signal<Ticket[]>([]);

  minutes = computed(() => this.found() ? minutesBetween(this.found()!.checkedInAt, this.now()) : 0);
  rule = computed(() => this.found() ? this.context.rule(this.found()!.vehicleType) : undefined);
  /** Ultimo calculo del servidor; mientras llega se usa la estimacion local con la misma regla. */
  calculation = signal<PricingCalculation | null>(null);
  /** Renglones del cobro: dias, primera hora y horas adicionales, como los calcula pricing-service. */
  breakdown = computed(() => {
    const rule = this.rule();
    if (!rule) return [];
    if (rule.pricingModel === 'FLAT') return [{ label: 'Tarifa plana', amount: Number(rule.flatAmount) || 0 }];
    const charge = this.calculation() ?? estimateCharge(rule, this.minutes());
    const day = Number(rule.dayAmount) || 0;
    const additional = Number(rule.additionalHourAmount ?? rule.hourlyAmount) || 0;
    const rows: { label: string; amount: number }[] = [];
    if (charge.days) rows.push({ label: `${charge.days} ${charge.days === 1 ? 'día' : 'días'} × ${money(day)}`, amount: charge.days * day });
    if (charge.firstHourCharged) rows.push({ label: 'Primera hora', amount: Number(rule.hourlyAmount) || 0 });
    if (charge.additionalMinutes) {
      rows.push({ label: `Tiempo adicional: ${durationText(charge.additionalMinutes)} (${money(additional)}/h)`, amount: Number(charge.additionalAmount) || 0 });
    }
    return rows;
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
        this.calculation.set(null);
        this.paymentMethod.set('CASH');
        this.onlineReference = '';
        this.resetDiscount();
        this.search = displayPlate(ticket.plate);
        if (ticket.monthlySubscription) {
          this.total.set(0);
          this.searching.set(false);
          return;
        }
        this.price(ticket).subscribe({
          next: result => { this.applyPrice(result); this.searching.set(false); },
          error: err => { this.toast.err(apiErrorMessage(err, 'No se pudo calcular la tarifa de este vehículo')); this.searching.set(false); }
        });
      },
      error: err => {
        this.found.set(null);
        this.searching.set(false);
        this.toast.err(err?.status === 404 ? `No hay un vehículo adentro con placa ${displayPlate(plate)}` : apiErrorMessage(err, 'No se pudo consultar el vehículo'));
      }
    });
  }

  /** El servidor calcula el valor final y registra la salida y el cobro en caja en una sola operacion. */
  confirm() {
    const ticket = this.found();
    if (!ticket || this.paying()) return;
    if (!ticket.monthlySubscription && this.discount() > this.total()) {
      this.toast.err(`El descuento no puede ser mayor que el total (${money(this.total())})`);
      return;
    }
    this.paying.set(true);
    this.checkOut(ticket);
  }

  /** Reimprime el ticket de entrada (por ejemplo, si el conductor lo perdio). */
  reprint() {
    const ticket = this.found();
    if (ticket) this.printer.print(ticket, { reprint: true });
  }

  cancel() {
    this.found.set(null);
    this.search = '';
    this.resetDiscount();
  }

  setDiscount(value: number | string | null) {
    this.discount.set(Math.max(0, Math.round(Number(value) || 0)));
  }

  toggleDiscount() {
    if (this.showDiscount()) this.resetDiscount();
    else this.showDiscount.set(true);
  }

  private resetDiscount() {
    this.discount.set(0);
    this.discountReason = '';
    this.showDiscount.set(false);
  }

  elapsedText() { return durationText(this.minutes()); }
  rateText() {
    const rule = this.rule();
    if (!rule) return '—';
    if (rule.pricingModel === 'FLAT') return `${money(rule.flatAmount)} tarifa plana`;
    return `1ª hora ${money(rule.hourlyAmount)} · adicional ${money(rule.additionalHourAmount ?? rule.hourlyAmount)}`;
  }
  methodLabel() { return paymentMethodMeta(this.paymentMethod()).label; }

  meta = vehicleMeta;
  helmets = helmetLockersOf;
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
    this.calculation.set(result);
    this.lastPricedMinute = Math.floor(this.minutes());
  }

  private checkOut(ticket: Ticket) {
    const method = this.paymentMethod();
    const discount = ticket.monthlySubscription ? 0 : this.discount();
    const body = {
      paymentMethod: method,
      onlineReference: method === 'ONLINE' ? this.onlineReference.trim() || null : null,
      discountAmount: discount > 0 ? discount : null,
      discountReason: discount > 0 ? this.discountReason.trim() || null : null
    };
    this.http.post<Ticket>(`${API.operation}/tickets/${ticket.uuid}/check-out`, body, tenantHeaders(this.tenantId)).subscribe({
      next: closed => {
        const amount = Number(closed.amountDue) || 0;
        const released = [closed.spaceCode && `Slot ${closed.spaceCode}`, closed.keySlotCode && `tablero ${closed.keySlotCode}`, helmetLockersOf(closed).length && `casillero${helmetLockersOf(closed).length > 1 ? "s" : ""} ${helmetLockersOf(closed).join(" y ")}`]
          .filter(Boolean).join(' y ');
        const charge = closed.monthlySubscription ? 'Mensualidad, sin cobro'
          : amount > 0 ? `Cobro: ${money(amount)} (${paymentMethodMeta(closed.paymentMethod).label.toLowerCase()})` : 'Sin cobro';
        const discountText = Number(closed.discountAmount) > 0 ? ` · descuento ${money(closed.discountAmount)}` : '';
        this.toast.ok(`Salida de ${displayPlate(closed.plate)} registrada. ${charge}${discountText}`);
        if (released) window.setTimeout(() => this.toast.info(`${released} liberados`, '🔓'), 1000);
        this.found.set(null);
        this.search = '';
        this.total.set(0);
        this.onlineReference = '';
        this.resetDiscount();
        this.paying.set(false);
        this.loadActive();
      },
      // Si el cobro no entra a caja el backend revierte la salida: el vehiculo sigue adentro.
      error: err => {
        this.toast.err(apiErrorMessage(err, 'No se pudo registrar la salida del vehículo'));
        this.paying.set(false);
      }
    });
  }
}
