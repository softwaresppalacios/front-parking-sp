import { Injectable, inject } from '@angular/core';
import { Ticket } from '../models';
import { ParkingContextService } from '../state/parking-context.service';
import { displayPlate, hhmm, money, readStorage, vehicleMeta, writeStorage } from '../utils';

const AUTO_PRINT_KEY = 'sp_print_ticket_on_entry';

/**
 * Ticket de entrada impreso (impresora termica de 80 mm) para entregar al conductor cuando el ticket
 * no llega por WhatsApp. Se imprime desde un iframe oculto con su propio HTML para no depender de los
 * estilos de la aplicacion.
 */
@Injectable({ providedIn: 'root' })
export class TicketPrinterService {
  private context = inject(ParkingContextService);

  /** Preferencia de este navegador: imprimir siempre al registrar una entrada. */
  autoPrint(): boolean {
    return readStorage<boolean>(AUTO_PRINT_KEY, false);
  }

  setAutoPrint(value: boolean) {
    writeStorage(AUTO_PRINT_KEY, value);
  }

  print(ticket: Ticket, options: { reprint?: boolean } = {}) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) { frame.remove(); return; }
    doc.open();
    doc.write(this.html(ticket, !!options.reprint));
    doc.close();
    const cleanup = () => window.setTimeout(() => frame.remove(), 500);
    win.addEventListener('afterprint', cleanup);
    // Espera a que el documento del iframe termine de pintarse antes de abrir el dialogo de impresion.
    window.setTimeout(() => {
      win.focus();
      win.print();
      window.setTimeout(cleanup, 60_000);
    }, 250);
  }

  private html(ticket: Ticket, reprint: boolean) {
    const branch = this.context.branch();
    const parkingName = branch?.name || this.context.parkingName();
    const rule = this.context.rule(ticket.vehicleType);
    const checkedIn = new Date(ticket.checkedInAt);
    const date = checkedIn.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const helmets = ticket.helmetLockerCodes?.length ? ticket.helmetLockerCodes : (ticket.helmetLockerCode ? [ticket.helmetLockerCode] : []);
    const rows: [string, string][] = [
      ['Fecha', date],
      ['Hora de entrada', hhmm(checkedIn)],
      ['Tipo', `${vehicleMeta(ticket.vehicleType).label}`],
      ['Lugar', ticket.spaceCode || 'Sin asignar']
    ];
    if (ticket.keySlotCode) rows.push(['Tablero llaves', ticket.keySlotCode]);
    if (helmets.length) rows.push([helmets.length > 1 ? 'Casilleros casco' : 'Casillero casco', helmets.join(', ')]);
    if (ticket.driverName) rows.push(['Conductor', ticket.driverName]);
    if (ticket.driverDocument) rows.push(['Cédula', ticket.driverDocument]);

    let rate = '';
    if (ticket.monthlySubscription) {
      rate = 'Mensualidad vigente: sin cobro a la salida';
    } else if (rule?.pricingModel === 'FLAT') {
      rate = `Tarifa plana: ${money(rule.flatAmount)}`;
    } else if (rule) {
      rate = `Primera hora ${money(rule.hourlyAmount)} · hora adicional ${money(rule.additionalHourAmount ?? rule.hourlyAmount)}`;
    }

    const header = [branch?.nit ? `NIT ${branch.nit}` : '', branch?.address || '', branch?.phone ? `Tel. ${branch.phone}` : '']
      .filter(Boolean).map(line => `<div>${this.escape(line)}</div>`).join('');

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Ticket ${this.escape(displayPlate(ticket.plate))}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { width: 72mm; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
  .center { text-align: center; }
  .brand { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
  .park { font-size: 13px; font-weight: bold; margin-top: 2px; }
  .muted { font-size: 11px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .plate { font-size: 26px; font-weight: bold; letter-spacing: 3px; text-align: center; border: 2px solid #000; padding: 4px 0; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; padding: 1px 0; }
  .row span:last-child { font-weight: bold; text-align: right; }
  .note { font-size: 11px; text-align: center; margin-top: 4px; }
  .tag { font-size: 11px; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px; margin-top: 4px; }
</style></head>
<body>
  <div class="center">
    <div class="brand">SP PARQUEADEROS</div>
    <div class="park">${this.escape(parkingName)}</div>
    <div class="muted">${header}</div>
  </div>
  <div class="sep"></div>
  <div class="center muted">TICKET DE ENTRADA</div>
  <div class="plate">${this.escape(displayPlate(ticket.plate))}</div>
  ${rows.map(([key, value]) => `<div class="row"><span>${this.escape(key)}</span><span>${this.escape(value)}</span></div>`).join('')}
  ${rate ? `<div class="sep"></div><div class="note">${this.escape(rate)}</div>` : ''}
  <div class="sep"></div>
  <div class="note">Conserve este ticket y preséntelo al retirar su vehículo.</div>
  ${ticket.code ? `<div class="note">Ticket ${this.escape(ticket.code)}</div>` : ''}
  ${reprint ? `<div class="tag">REIMPRESIÓN ${this.escape(new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }))}</div>` : ''}
</body></html>`;
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
  }
}
