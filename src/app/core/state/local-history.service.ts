import { Injectable } from '@angular/core';
import { Ticket } from '../models';
import { readStorage, writeStorage } from '../utils';

export type StoredTicket = Ticket;

const MAX_TICKETS = 3000;

/**
 * Tickets vistos guardados en el navegador. El backend solo expone los ultimos 25 tickets,
 * asi que aqui se acumulan para los reportes por rango de fechas (pendiente de pasar al backend).
 * La caja, los pagos y los cierres ya viven en payment-cash-service.
 */
@Injectable({ providedIn: 'root' })
export class LocalHistoryService {
  tickets(tenantId: string): StoredTicket[] {
    return Object.values(readStorage<Record<string, StoredTicket>>(this.ticketsKey(tenantId), {}))
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  }

  mergeTickets(tenantId: string, tickets: Ticket[]) {
    if (!tenantId || !tickets.length) return;
    const stored = readStorage<Record<string, StoredTicket>>(this.ticketsKey(tenantId), {});
    tickets.forEach(ticket => { stored[ticket.uuid] = { ...stored[ticket.uuid], ...ticket }; });
    const trimmed = Object.values(stored)
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
      .slice(0, MAX_TICKETS);
    writeStorage(this.ticketsKey(tenantId), Object.fromEntries(trimmed.map(ticket => [ticket.uuid, ticket])));
  }

  private ticketsKey(tenantId: string) { return `sp_tickets_${tenantId}`; }
}
