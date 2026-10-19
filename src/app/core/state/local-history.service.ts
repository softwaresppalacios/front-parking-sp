import { Injectable } from '@angular/core';
import { CashClosure, CashMovement, CashMovementRow, MonthlySubscription, Ticket } from '../models';
import { dateKey, displayPlate, durationText, hhmm, minutesBetween, readStorage, writeStorage } from '../utils';

export type StoredTicket = Ticket & { paymentMethod?: string };

const MAX_TICKETS = 3000;

/**
 * Historial guardado en el navegador. El backend solo expone los ultimos 25 tickets y la caja del dia,
 * asi que aqui se acumulan los tickets vistos y los cierres de caja para reportes por rango de fechas.
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

  recordPayment(tenantId: string, ticket: Ticket, method: string) {
    this.mergeTickets(tenantId, [{ ...ticket, paymentMethod: method } as StoredTicket]);
  }

  closures(tenantId: string): CashClosure[] {
    return readStorage<CashClosure[]>(this.closuresKey(tenantId), [])
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  saveClosure(tenantId: string, closure: CashClosure) {
    const others = this.closures(tenantId).filter(item => item.date !== closure.date);
    writeStorage(this.closuresKey(tenantId), [closure, ...others]);
  }

  closureFor(tenantId: string, date = dateKey(new Date())) {
    return this.closures(tenantId).find(item => item.date === date) || null;
  }

  /** Une los pagos del dia con los tickets y mensualidades que los originaron. */
  movementRows(payments: CashMovement[], tickets: Ticket[], subscriptions: MonthlySubscription[]): CashMovementRow[] {
    const ticketsByUuid = new Map(tickets.map(ticket => [ticket.uuid, ticket]));
    const subscriptionsByUuid = new Map(subscriptions.map(item => [item.uuid, item]));
    return [...payments]
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
      .map((payment, index) => {
        const ticket = ticketsByUuid.get(payment.ticketUuid);
        const subscription = subscriptionsByUuid.get(payment.ticketUuid);
        const method = payment.method === 'DIGITAL' ? 'DIGITAL' : 'CASH';
        const base = { n: String(index + 1).padStart(3, '0'), method, amount: Number(payment.amount) || 0, paidAt: payment.paidAt } as const;
        if (ticket) {
          const exit = ticket.checkedOutAt || payment.paidAt;
          return {
            ...base,
            plate: displayPlate(ticket.plate),
            vehicleType: ticket.vehicleType,
            entry: hhmm(ticket.checkedInAt),
            exit: hhmm(exit),
            duration: durationText(minutesBetween(ticket.checkedInAt, exit)),
            monthly: false
          };
        }
        return {
          ...base,
          plate: subscription ? displayPlate(subscription.plate) : '—',
          vehicleType: subscription?.vehicleType || 'CAR',
          entry: '—',
          exit: hhmm(payment.paidAt),
          duration: subscription ? 'Mensualidad' : '—',
          monthly: !!subscription
        };
      });
  }

  private ticketsKey(tenantId: string) { return `sp_tickets_${tenantId}`; }
  private closuresKey(tenantId: string) { return `sp_cash_closures_${tenantId}`; }
}
