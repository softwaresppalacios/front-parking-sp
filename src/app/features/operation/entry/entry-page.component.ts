import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { CheckInResponse, MonthlySubscription, Resource, ResourceBoard, Ticket, WhatsappChannel, WhatsappStatus } from '../../../core/models';
import { LocalHistoryService } from '../../../core/state/local-history.service';
import { ParkingContextService } from '../../../core/state/parking-context.service';
import { ToastService } from '../../../core/ui/toast.service';
import {
  apiErrorMessage, VEHICLE_TYPES, cleanPlate, displayPlate, formatPlate, hhmm, shortDate, tenantHeaders, tenantIdFromRoute, usesCompactSpace, vehicleMeta, whatsappUrl
} from '../../../core/utils';

@Component({
  selector: 'entry-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  /** Propietario o admin: pueden ir a Configuracion a definir la capacidad. */
  canManage = inject(AuthService).canManage(this.tenantId);

  plate = '';
  vehicleType = '';
  phone = '';
  driverName = '';
  driverDocument = '';
  selectedSpace = '';
  selectedKeySlot = '';
  /** Un casillero por casco: una moto puede dejar hasta 2 cascos. */
  selectedHelmetLockers: string[] = [];
  monthlyUuid = '';
  sendWhatsapp = true;
  previewCode = this.randomCode();
  now = new Date();

  board = signal<ResourceBoard | null>(null);
  saving = signal(false);
  lastTicket = signal<{ ticket: Ticket; phone: string; whatsapp: WhatsappStatus | null } | null>(null);
  resending = signal(false);
  /** false cuando el servidor tiene el envio en pausa (WHATSAPP_ENABLED=false). */
  whatsappEnabled = signal(true);

  constructor() {
    this.loadBoard();
    this.http.get<WhatsappChannel>(`${API.operation}/tickets/whatsapp/status`, tenantHeaders(this.tenantId)).subscribe({
      next: channel => {
        this.whatsappEnabled.set(channel.enabled);
        if (!channel.enabled) this.sendWhatsapp = false;
      },
      error: () => undefined
    });
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
      next: board => {
        this.board.set(board);
        // Si el tipo se eligio antes de que llegara el tablero, se preselecciona ahora.
        if (this.vehicleType && !this.selectedSpace) this.preselectSpace();
      },
      error: () => this.board.set(null)
    });
  }

  spaces(): Resource[] {
    if (!this.context.manageResources()) return [];
    const board = this.board();
    const items = usesCompactSpace(this.vehicleType) ? board?.motorcycleSpaces : board?.carSpaces;
    return this.sorted(items || []);
  }
  freeSpaces() { return this.spaces().filter(item => !this.isTaken(item)).length; }
  spaceKind() { return usesCompactSpace(this.vehicleType) ? 'motos' : 'carros'; }
  keySlots() { return this.sorted(this.board()?.keySlots || []); }
  helmetLockers() { return this.sorted(this.board()?.helmetLockers || []); }
  isTaken(item: Resource) { return item.occupied || item.reserved; }
  showsKeySlots() { return this.context.manageResources() && !usesCompactSpace(this.vehicleType); }
  showsHelmetLockers() { return this.context.manageResources() && usesCompactSpace(this.vehicleType); }

  pick(kind: 'space' | 'key' | 'helmet', item: Resource) {
    if (this.isTaken(item)) return;
    if (kind === 'space') this.selectedSpace = this.selectedSpace === item.code ? '' : item.code;
    if (kind === 'key') this.selectedKeySlot = this.selectedKeySlot === item.code ? '' : item.code;
    if (kind === 'helmet') this.toggleHelmetLocker(item.code);
  }

  /** Moto: hasta 2 casilleros (uno por casco). Bicicleta: uno. */
  maxHelmets() { return this.vehicleType === 'MOTORCYCLE' ? 2 : 1; }

  private toggleHelmetLocker(code: string) {
    const selected = this.selectedHelmetLockers;
    if (selected.includes(code)) {
      this.selectedHelmetLockers = selected.filter(item => item !== code);
    } else if (selected.length < this.maxHelmets()) {
      this.selectedHelmetLockers = [...selected, code];
    } else if (this.maxHelmets() === 1) {
      this.selectedHelmetLockers = [code];
    } else {
      this.toast.info('Una moto puede guardar máximo 2 cascos. Quita uno para elegir otro casillero.', '⛑');
    }
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
    this.selectedHelmetLockers = [];
    this.preselectSpace();
  }

  /** Propone el primer espacio libre del tipo elegido; el cajero puede cambiarlo con un clic. */
  private preselectSpace() {
    if (!this.vehicleType || !this.context.manageResources()) return;
    this.selectedSpace = this.spaces().find(item => !this.isTaken(item))?.code || '';
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
  keyText() { return this.showsHelmetLockers() ? this.helmetText() : (this.selectedKeySlot || '—'); }
  helmetText() { return this.selectedHelmetLockers.join(', ') || '—'; }
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
    if (this.context.manageResources() && !this.selectedSpace) {
      this.toast.err(this.spaces().length
        ? `No hay espacios de ${this.spaceKind()} libres: seleccione uno o espere una salida`
        : `El parqueadero no tiene espacios de ${this.spaceKind()} configurados`);
      return;
    }

    const phone = this.phone;
    this.saving.set(true);
    this.http.post<CheckInResponse>(`${API.operation}/tickets/check-in`, {
      plate,
      vehicleType: this.vehicleType,
      driverPhone: phone,
      driverName: this.driverName.trim() || null,
      driverDocument: this.driverDocument.trim() || null,
      sendWhatsapp: this.sendWhatsapp,
      spaceCode: this.context.manageResources() ? this.selectedSpace : '',
      keySlotCode: this.showsKeySlots() ? this.selectedKeySlot : '',
      helmetLockerCodes: this.showsHelmetLockers() ? this.selectedHelmetLockers : [],
      monthlySubscription: !!this.monthlyUuid
    }, tenantHeaders(this.tenantId)).subscribe({
      next: ({ ticket, whatsapp }) => {
        this.history.mergeTickets(this.tenantId, [ticket]);
        this.lastTicket.set({ ticket, phone, whatsapp });
        this.toast.ok(`Vehículo ${displayPlate(ticket.plate)} registrado exitosamente`);
        if (whatsapp) window.setTimeout(() => this.announceWhatsapp(whatsapp, phone), 900);
        this.resetForm();
        this.loadBoard();
        this.saving.set(false);
      },
      error: err => {
        this.toast.err(this.errorMessage(err));
        this.saving.set(false);
      }
    });
  }

  /** Reenvia la plantilla desde la linea de WhatsApp del parqueadero (Meta). */
  resendWhatsapp() {
    const last = this.lastTicket();
    if (!last || this.resending()) return;
    this.resending.set(true);
    this.http.post<WhatsappStatus>(`${API.operation}/tickets/${last.ticket.uuid}/whatsapp`, {}, tenantHeaders(this.tenantId)).subscribe({
      next: whatsapp => {
        this.resending.set(false);
        this.lastTicket.set({ ...last, whatsapp });
        this.announceWhatsapp(whatsapp, last.phone);
      },
      error: err => {
        this.resending.set(false);
        this.toast.err(apiErrorMessage(err, 'No se pudo reenviar el ticket'));
      }
    });
  }

  /** Respaldo manual: abre WhatsApp Web con el ticket escrito. */
  openWhatsappWeb() {
    const last = this.lastTicket();
    if (last) window.open(whatsappUrl(last.phone, this.whatsappText(last.ticket)), '_blank');
  }

  private announceWhatsapp(whatsapp: WhatsappStatus, phone: string) {
    if (whatsapp.sent) this.toast.info(`Ticket enviado por WhatsApp a ${phone}`, '📲');
    else this.toast.err(`El ticket no se envió por WhatsApp: ${whatsapp.error || 'error desconocido'}`);
  }

  private whatsappText(ticket: Ticket) {
    const lines = [
      'Este es tu ticket de parqueadero',
      '',
      `ID ticket: ${ticket.code || this.codeFor(ticket)}`,
      `Parqueadero: ${this.context.branch()?.name || this.context.parkingName()}`,
      `Nombre: ${ticket.driverName || '—'}`,
      `Cedula: ${ticket.driverDocument || '—'}`,
      `Lugar: ${ticket.spaceCode || 'Sin asignar'}`,
      `Placa: ${displayPlate(ticket.plate)}`,
      `Fecha y hora: ${new Date(ticket.checkedInAt).toLocaleDateString('es-CO')} ${hhmm(ticket.checkedInAt)}`,
      '',
      'SP parqueaderos 🚗🅿️'
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
    if (!this.driverName && subscription.customerName) this.driverName = subscription.customerName;
    if (!this.driverDocument && subscription.customerDocument) this.driverDocument = subscription.customerDocument;
  }

  private resetForm() {
    this.plate = '';
    this.vehicleType = '';
    this.phone = '';
    this.driverName = '';
    this.driverDocument = '';
    this.monthlyUuid = '';
    this.onTypeChange();
    this.previewCode = this.randomCode();
  }

  private errorMessage(err: { status?: number; error?: { message?: string } }) {
    if (err?.status === 409) return 'El vehículo ya tiene un ticket activo o el espacio no está disponible';
    if (err?.status === 0) return 'No hay conexión con el servicio de operación';
    return apiErrorMessage(err, 'No se pudo registrar la entrada');
  }

  private codeFor(ticket: Ticket) { return 'SPP-' + ticket.uuid.replace(/-/g, '').slice(0, 6).toUpperCase(); }
  private randomCode() { return 'SPP-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }
  private sorted(items: Resource[]) { return [...items].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })); }
}
