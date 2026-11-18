import { Routes } from '@angular/router';
import { authGuard, guestGuard, manageGuard, sessionGuard, tenantAccessGuard } from './core/auth/auth.guards';
import { ChangePasswordPageComponent } from './features/auth/change-password/change-password-page.component';
import { LoginPageComponent } from './features/auth/login/login-page.component';
import { RegisterPageComponent } from './features/auth/register/register-page.component';
import { CashPageComponent } from './features/cash/pages/cash-page.component';
import { CashReportsPageComponent } from './features/cash-reports/pages/cash-reports-page.component';
import { ConfigPageComponent } from './features/config/pages/config-page.component';
import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page.component';
import { MonthlyPageComponent } from './features/monthly/pages/monthly-page.component';
import { EntryPageComponent } from './features/operation/entry/entry-page.component';
import { ExitPageComponent } from './features/operation/exit/exit-page.component';
import { ReportsPageComponent } from './features/reports/pages/reports-page.component';
import { AuditPageComponent } from './features/audit/pages/audit-page.component';
import { TicketHistoryPageComponent } from './features/tickets/pages/ticket-history-page.component';
import { TenantBoardComponent } from './features/tenant/tenant-board/tenant-board.component';
import { ParkingShellComponent } from './layout/parking-shell/parking-shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPageComponent, canActivate: [guestGuard] },
  { path: 'registro', component: RegisterPageComponent, canActivate: [guestGuard] },
  { path: 'cambiar-clave', component: ChangePasswordPageComponent, canActivate: [sessionGuard] },
  { path: 'parkings', component: TenantBoardComponent, canActivate: [authGuard] },
  {
    path: 'parking/:tenantUuid',
    component: ParkingShellComponent,
    canActivate: [tenantAccessGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent, data: { title: 'Dashboard — Tiempo Real' } },
      { path: 'entrada', component: EntryPageComponent, data: { title: 'Registrar Entrada' } },
      { path: 'salida', component: ExitPageComponent, data: { title: 'Registrar Salida' } },
      { path: 'caja', component: CashPageComponent, data: { title: 'Caja del Día' } },
      { path: 'mensualidades', component: MonthlyPageComponent, data: { title: 'Mensualidades' } },
      { path: 'historial-tickets', component: TicketHistoryPageComponent, data: { title: 'Historial de Tickets' } },
      { path: 'reportes', component: ReportsPageComponent, canActivate: [manageGuard], data: { title: 'Reportes' } },
      { path: 'reportes-caja', component: CashReportsPageComponent, canActivate: [manageGuard], data: { title: 'Reportes de Caja' } },
      { path: 'auditoria', component: AuditPageComponent, canActivate: [manageGuard], data: { title: 'Auditoría' } },
      { path: 'config', component: ConfigPageComponent, canActivate: [manageGuard], data: { title: 'Configuración' } },
      { path: 'config/:section', redirectTo: 'config' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
