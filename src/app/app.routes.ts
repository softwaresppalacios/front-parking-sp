import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/login/login-page.component';
import { CashPageComponent } from './features/cash/pages/cash-page.component';
import { ConfigPageComponent } from './features/config/pages/config-page.component';
import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page.component';
import { MonthlyPageComponent } from './features/monthly/pages/monthly-page.component';
import { EntryPageComponent } from './features/operation/entry/entry-page.component';
import { ExitPageComponent } from './features/operation/exit/exit-page.component';
import { ReportsPageComponent } from './features/reports/pages/reports-page.component';
import { TenantBoardComponent } from './features/tenant/tenant-board/tenant-board.component';
import { ParkingShellComponent } from './layout/parking-shell/parking-shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPageComponent },
  { path: 'parkings', component: TenantBoardComponent },
  {
    path: 'parking/:tenantUuid',
    component: ParkingShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'entrada', component: EntryPageComponent },
      { path: 'salida', component: ExitPageComponent },
      { path: 'caja', component: CashPageComponent },
      { path: 'mensualidades', component: MonthlyPageComponent },
      { path: 'reportes', component: ReportsPageComponent },
      { path: 'config', component: ConfigPageComponent }
    ]
  }
];
