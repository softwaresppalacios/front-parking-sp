import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { MonthlySubscription, Resource, ResourceBoard, Ticket } from '../../../core/models';
import { LocalHistoryService } from '../../../core/state/local-history.service';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  VEHICLE_TYPES, cleanPlate, displayPlate, formatPlate, hhmm, shortDate, tenantHeaders, tenantIdFromRoute, usesCompactSpace, vehicleMeta, whatsappUrl
} from '../../../core/utils';

@Component({
  selector: 'entry-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entry-page.component.html'
})
export class EntryPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private history = inject(LocalHistoryService);
  context = inject(ParkingContextService);
  tenantId = tenantIdFromRoute(this.route);
  vehicleTypes = VEHICLE_TYPES;

  plate = '';
  vehicleType = '';
  phone = '';
  selectedSpace = '';
  selectedKeySlot = '';
  selectedHelmetLocker = '';
  monthlyUuid = '';
  sendWhatsapp = true;
  previewCode = this.randomCode();
  now = new Date();

  board = signal<ResourceBoard | null>(null);
  saving = signal(false);
  lastTicket = signal<{ ticket: Ticket; phone: string } | null>(null);

  constructor() {
    this.loadBoard();
    const clock = window.setInterval(() => { this.now = new Date(); }, 15_000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(clock));
    const slot = this.route.snapshot.queryParamMap.get('slot');
    if (slot) {
      this.vehicleType = slot.startsWith('M') ? 'MOTORCYCLE' : 'CAR';
      this.selectedSpace = slot;
    }
  }

  loadBoard() {
    this.http.get<ResourceBoard>(`${API.operation}/resources/board`, tenantHeaders(this.tenantId)).subscribe({
      next: board => this.board.set(board),
      error: () => this.board.set(null)
    });
  }

  spaces(): Resource[] {
    if (!this.context.manageResources()) return [];
    const board = this.board();
    const items = usesCompactSpace(this.vehicleType) ? board?.motorcycleSpaces : board?.carSpaces;
    return this.sorted(items || []);
  }
  keySlots() { return this.sorted(this.board()?.keySlots || []); }
  helmetLockers() { return this.sorted(this.board()?.helmetLockers || []); }
  isTaken(item: Resource) { return item.occupied || item.reserved; }
  showsKeySlots() { return this.context.manageResources() && !usesCompactSpace(this.vehicleType); }
  showsHelmetLockers() { return this.context.manageResources() && usesCompactSpace(this.vehicleType); }

  pick(kind: 'space' | 'key' | 'helmet', item: Resource) {
    if (this.isTaken(item)) return;
    if (kind === 'space') this.selectedSpace = this.selectedSpace === item.code ? '' : item.code;
    if (kind === 'key') this.selectedKeySlot = this.selectedKeySlot === item.code ? '' : item.code;
    if (kind === 'helmet') this.selectedHelmetLocker = this.selectedHelmetLocker === item.code ? '' : item.code;
  }

  onPlateChange(value: string) {
    this.plate = formatPlate(value);
    const subscription = this.context.activeSubscriptionFor(cleanPlate(this.plate));
    if (subscription) {
      this.applySubscription(subscription);
    } else if (this.monthlyUuid) {
      const current = this.context.activeSubscriptions().find(item => item.uuid === this.monthlyUuid);
      if (current && current.plate !== cleanPlate(this.plate)) this.monthlyUuid = '';
    }
  }

  onTypeChange() {
    this.selectedSpace = '';
    this.selectedKeySlot = '';
    this.selectedHelmetLocker = '';
  }

  onMonthlyChange(uuid: string) {
    this.monthlyUuid = uuid;
    const subscription = this.context.activeSubscriptions().find(item => item.uuid === uuid);
    if (subscription) this.applySubscription(subscription);
  }

  subscriptionLabel(item: MonthlySubscription) {
    return `✓ ${displayPlate(item.plate)} — ${item.customerName} (vence ${shortDate(item.expiresAt)})`;
  }

  typeOption(type: string) { return `${vehicleMeta(type).emoji} ${this.context.vehicleName(type)}`; }
  typeLabel() { return this.vehicleType ? this.typeOption(this.vehicleType) : '—'; }
  keyText() { return this.showsHelmetLockers() ? (this.selectedHelmetLocker || '—') : (this.selectedKeySlot || '—'); }
  ticketCode() { return this.lastTicket() && !this.plate ? this.codeFor(this.lastTicket()!.ticket) : this.previewCode; }
  fecha() { return this.now.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); }
  hora() { return hhmm(this.now); }
  address() {
    const branch = this.context.branch();
    return [branch?.name, branch?.address].filter(Boolean).join(' · ') || this.context.parkingName();
  }

  checkIn() {
    if (this.saving()) return;
    this.now = new Date();
    const plate = cleanPlate(this.plate);
    if (!plate || plate.length < 5) { this.toast.err('Ingrese una placa válida'); return; }
    if (!this.vehicleType) { this.toast.err('Seleccione el tipo de vehículo'); return; }
    if (!this.phone || this.phone.replace(/\D/g, '').length < 7) { this.toast.err('Ingrese el celular del conductor'); return; }
    if (this.context.manageResources() && !this.selectedSpace) { this.toast.err('Seleccione un slot disponible'); return; }

    // La ventana se abre dentro del clic para que el navegador no la bloquee; se llena al guardar.
    const waWindow = this.sendWhatsapp ? window.open('', '_blank') : null;
    const phone = this.phone;
    this.saving.set(true);
    this.http.post<Ticket>(`${API.operation}/tickets/check-in`, {
      plate,
      vehicleType: this.vehicleType,
      driverPhone: phone,
      spaceCode: this.context.manageResources() ? this.selectedSpace : '',
      keySlotCode: this.showsKeySlots() ? this.selectedKeySlot : '',
      helmetLockerCode: this.showsHelmetLockers() ? this.selectedHelmetLocker : '',
      monthlySubscription: !!this.monthlyUuid
    }, tenantHeaders(this.tenantId)).subscribe({
      next: ticket => {
        this.history.mergeTickets(this.tenantId, [ticket]);
        this.lastTicket.set({ ticket, phone });
        this.toast.ok(`Vehículo ${displayPlate(ticket.plate)} registrado exitosamente`);
        if (waWindow) {
          waWindow.location.href = whatsappUrl(phone, this.whatsappText(ticket));
          window.setTimeout(() => this.toast.info(`Ticket enviado por WhatsApp a ${phone}`, '📲'), 1200);
        }
        this.resetForm();
        this.loadBoard();
        this.saving.set(false);
      },
      error: err => {
        waWindow?.close();
        this.toast.err(this.errorMessage(err));
        this.saving.set(false);
      }
    });
  }

  resendWhatsapp() {
    const last = this.lastTicket();
    if (last) window.open(whatsappUrl(last.phone, this.whatsappText(last.ticket)), '_blank');
  }

  private whatsappText(ticket: Ticket) {
    const lines = [
      '🅿️ *SP Parqueaderos*',
      this.context.parkingName(),
      `Placa: ${displayPlate(ticket.plate)}`,
      `Slot: ${ticket.spaceCode || '—'}`,
      `Llaves: ${ticket.keySlotCode || ticket.helmetLockerCode || '—'}`,
      `Hora: ${hhmm(ticket.checkedInAt)}`,
      `Ticket: ${this.codeFor(ticket)}`,
      'Guarde este mensaje como comprobante.'
    ];
    return lines.join('\n');
  }

  private applySubscription(subscription: MonthlySubscription) {
    this.monthlyUuid = subscription.uuid;
    this.plate = displayPlate(subscription.plate);
    if (this.vehicleType !== subscription.vehicleType) {
      this.vehicleType = subscription.vehicleType;
      this.onTypeChange();
    }
    if (!this.phone && subscription.customerPhone) this.phone = subscription.customerPhone;
  }

  private resetForm() {
    this.plate = '';
    this.vehicleType = '';
    this.phone = '';
    this.monthlyUuid = '';
    this.onTypeChange();
    this.previewCode = this.randomCode();
  }

  private errorMessage(err: { status?: number; error?: { message?: string } }) {
    if (err?.status === 409) return 'El vehículo ya tiene un ticket activo o el espacio no está disponible';
    if (err?.status === 0) return 'No hay conexión con el servicio de operación';
    return err?.error?.message || 'No se pudo registrar la entrada';
  }

  private codeFor(ticket: Ticket) { return 'SPP-' + ticket.uuid.replace(/-/g, '').slice(0, 6).toUpperCase(); }
  private randomCode() { return 'SPP-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }
  private sorted(items: Resource[]) { return [...items].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })); }
}
