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
  monthlySubscription: boolean;
  checkedInAt: string;
  checkedOutAt?: string;
  status: string;
  amountDue?: number;
};

export type Resource = { code: string; kind: string; vehicleType?: string; occupied: boolean; reserved: boolean; assignedPlate?: string };
export type ResourceBoard = { carSpaces: Resource[]; motorcycleSpaces: Resource[]; keySlots: Resource[]; helmetLockers: Resource[] };
export type CashMovement = { id: number; ticketUuid: string; amount: number; method: string; paidAt: string };
export type CashSummary = { todayRevenue: number; cashRevenue: number; digitalRevenue: number; movements: number; recentMovements: CashMovement[] };
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
  hourlyAmount?: number | null;
  additionalHourAmount?: number | null;
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
export type PricingCalculation = { ticketUuid: string; billableMinutes: number; subtotal: number; surcharges: number; discounts: number; total: number };

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

/** Movimiento de caja enriquecido con los datos del ticket o la mensualidad que lo origino. */
export type CashMovementRow = {
  n: string;
  plate: string;
  vehicleType: string;
  entry: string;
  exit: string;
  duration: string;
  method: 'CASH' | 'DIGITAL';
  amount: number;
  paidAt: string;
  monthly: boolean;
};

/** Cierre de caja guardado en el navegador (el backend aun no persiste cierres). */
export type CashClosure = {
  id: string;
  date: string;
  openedAt: string;
  closedAt: string;
  responsible: string;
  vehicles: number;
  cash: number;
  digital: number;
  monthly: number;
  total: number;
  notes: string;
  movements: CashMovementRow[];
};
