import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { Resource, ResourceBoard, Ticket } from '../../../core/models';
import { tenantHeaders, tenantIdFromRoute, vehicleLabel } from '../../../core/utils';

@Component({
  selector: 'entry-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entry-page.component.html'
})
export class EntryPageComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  tenantId = tenantIdFromRoute(this.route);
  plate = '';
  vehicleType = 'CAR';
  phone = '';
  selectedSpace = '';
  selectedKeySlot = '';
  selectedHelmetLocker = '';
  monthlySubscription = false;
  board = signal<ResourceBoard | null>(null);
  ticket = signal<Ticket | null>(null);
  error = signal('');

  constructor() { this.loadBoard(); }

  loadBoard() { this.http.get<ResourceBoard>(`${API.operation}/resources/board`, tenantHeaders(this.tenantId)).subscribe(v => this.board.set(v)); }
  spaces() { return this.usesCompactSpace() ? (this.board()?.motorcycleSpaces || []) : (this.board()?.carSpaces || []); }
  available(items?: Resource[]) { return (items || []).filter(item => !item.occupied && !item.reserved); }
  onPlateChange(value: string) { this.plate = this.formatPlate(value); }
  resetAssignments() { this.selectedSpace = ''; this.selectedKeySlot = ''; this.selectedHelmetLocker = ''; }
  vehicleLabel() { return vehicleLabel(this.vehicleType); }
  usesCompactSpace() { return this.vehicleType === 'MOTORCYCLE' || this.vehicleType === 'BICYCLE'; }
  showsKeySlots() { return this.vehicleType === 'CAR' || this.vehicleType === 'HEAVY'; }
  showsHelmetLockers() { return this.vehicleType === 'MOTORCYCLE'; }

  private formatPlate(value: string) {
    return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  }

  checkIn() {
    this.error.set('');
    if (!this.plate || this.plate.length < 5) { this.error.set('Ingrese una placa valida.'); return; }
    if (!this.phone || this.phone.length < 7) { this.error.set('Ingrese el celular del conductor.'); return; }
    if (!this.selectedSpace) { this.error.set('Seleccione un espacio.'); return; }
    this.http.post<Ticket>(`${API.operation}/tickets/check-in`, {
      plate: this.plate,
      vehicleType: this.vehicleType,
      driverPhone: this.phone,
      spaceCode: this.selectedSpace,
      keySlotCode: this.selectedKeySlot,
      helmetLockerCode: this.selectedHelmetLocker,
      monthlySubscription: this.monthlySubscription
    }, tenantHeaders(this.tenantId))
      .subscribe({
        next: v => { this.ticket.set(v); this.plate = ''; this.phone = ''; this.monthlySubscription = false; this.resetAssignments(); this.loadBoard(); },
        error: err => this.error.set(err?.error?.message || 'No se pudo registrar la entrada.')
      });
  }
}
