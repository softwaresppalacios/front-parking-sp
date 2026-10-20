export type Tenant = { id: number; uuid: string; name: string; status: string; planName: string; branchLimit: number; branches: Branch[] };

export type Branch = {
  id: number;
  uuid: string;
  name: string;
  nit?: string;
  phone?: string;
  address: string;
  carCapacity?: number;
  motorcycleCapacity?: number;
  keyRackCapacity?: number;
  helmetLockerCapacity?: number;
  manageResources?: boolean;
  active: boolean;
  schedules?: Schedule[];
};

export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'HEAVY' | 'BICYCLE';

export type Ticket = {
  uuid: string;
  plate: string;
  vehicleType: string;
  spaceCode: string;
  keySlotCode?: string;
  helmetLockerCode?: string;
  /** Todos los casilleros de casco (una moto puede dejar hasta 2 cascos). */
  helmetLockerCodes?: string[];
  monthlySubscription: boolean;
  checkedInAt: string;
  checkedOutAt?: string;
  status: string;
  amountDue?: number;
  /** CASH u ONLINE; vacio si no hubo cobro (mensualidad o valor cero). */
  paymentMethod?: string | null;
  /** Codigo corto del ticket (SPP-XXXXXX). */
  code?: string;
  driverName?: string | null;
  driverDocument?: string | null;
};

/** Resultado del envio del ticket por WhatsApp (plantilla de Meta). */
export type WhatsappStatus = { sent: boolean; error?: string | null };
/** Estado del canal: enabled=false cuando el envio esta en pausa en el servidor. */
export type WhatsappChannel = { enabled: boolean; configured: boolean };
export type CheckInResponse = { ticket: Ticket; whatsapp: WhatsappStatus | null };

export type Resource = { code: string; kind: string; vehicleType?: string; occupied: boolean; reserved: boolean; assignedPlate?: string };
export type ResourceBoard = { carSpaces: Resource[]; motorcycleSpaces: Resource[]; keySlots: Resource[]; helmetLockers: Resource[] };
export type Schedule = { dayOfWeek: string; openTime: string | null; closeTime: string | null; closed: boolean };

export type DashboardSummary = {
  activeTickets: number;
  occupiedSpaces: number;
  availableSpaces: number;
  carOccupiedSpaces: number;
  carAvailableSpaces: number;
  motorcycleOccupiedSpaces: number;
  motorcycleAvailableSpaces: number;
  todayRevenue: number;
};

export type BranchConfiguration = {
  id: number;
  uuid: string;
  name: string;
  nit?: string;
  phone?: string;
  address?: string;
  carCapacity: number;
  motorcycleCapacity: number;
  keyRackCapacity: number;
  helmetLockerCapacity: number;
  manageResources: boolean;
  active: boolean;
  schedules: Schedule[];
};

export type PricingRule = {
  id?: number;
  tenantId?: string;
  vehicleType: string;
  displayName: string;
  pricingModel: 'FLAT' | 'PROGRESSIVE';
  flatAmount?: number | null;
  /** Valor de la primera hora (o fraccion). */
  hourlyAmount?: number | null;
  /** Valor por hora del tiempo despues de la primera hora (los minutos se cobran proporcionalmente). */
  additionalHourAmount?: number | null;
  /** Ya no se usan en el calculo; se conservan por compatibilidad. */
  fractionAmount?: number | null;
  fractionMinutes: number;
  dayAmount?: number | null;
  applyDailyCap: boolean;
  rateIncreaseAfterHours?: number | null;
  rateIncreaseAmount?: number | null;
  lostTicketFee?: number | null;
  active: boolean;
};

export type PricingCatalog = { rules: PricingRule[] };
export type PricingCalculation = {
  ticketUuid: string;
  billableMinutes: number;
  subtotal: number;
  surcharges: number;
  discounts: number;
  total: number;
  /** Desglose: dias cobrados con valor dia y si se cobro la primera hora. */
  days: number;
  firstHourCharged: boolean;
  /** Minutos despues de la primera hora y lo que se cobro por ellos. */
  additionalMinutes: number;
  additionalAmount: number;
};

export type MonthlySubscription = {
  id: number;
  uuid: string;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  plate: string;
  vehicleType: string;
  amount: number;
  paymentMethod?: string;
  startsAt: string;
  expiresAt: string;
  paidAt: string;
  active: boolean;
};

export type PaymentMethod = 'CASH' | 'ONLINE';

/** Cobro registrado en caja: PARKING al dar salida (horas o dia), MONTHLY al vender una mensualidad. */
export type CashPayment = {
  uuid: string;
  concept: 'PARKING' | 'MONTHLY';
  referenceUuid: string;
  amount: number;
  method: string;
  onlineReference?: string | null;
  plate?: string | null;
  vehicleType?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  description?: string | null;
  registeredByName?: string | null;
  paidAt: string;
};

export type CashTotals = { cash: number; online: number; parking: number; monthly: number; total: number; payments: number; vehicles: number };

/** Turno de caja. payments solo viene en la caja actual y en el detalle de un turno. */
export type CashSession = {
  uuid: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  openedByName?: string | null;
  openingFloat: number;
  closedAt?: string | null;
  closedByName?: string | null;
  totals: CashTotals;
  expectedCash: number;
  countedCash?: number | null;
  cashDifference?: number | null;
  notes?: string | null;
  payments?: CashPayment[] | null;
};

export type TodayCashSummary = { todayRevenue: number; cashRevenue: number; onlineRevenue: number; payments: number; yesterdayRevenue: number };
