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
  active: boolean;
  schedules?: Schedule[];
};

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
