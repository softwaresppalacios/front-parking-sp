import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/login/login-page.component';
import { CashPageComponent } from './features/cash/pages/cash-page.component';
import { ConfigBranchPageComponent } from './features/config/pages/config-branch-page.component';
import { ConfigHomePageComponent } from './features/config/pages/config-home-page.component';
import { ConfigPricingPageComponent } from './features/config/pages/config-pricing-page.component';
import { ConfigResourcesPageComponent } from './features/config/pages/config-resources-page.component';
import { ConfigSchedulePageComponent } from './features/config/pages/config-schedule-page.component';
import { ConfigShellComponent } from './features/config/pages/config-shell.component';
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
      {
        path: 'config',
        component: ConfigShellComponent,
        children: [
          { path: '', component: ConfigHomePageComponent },
          { path: 'home', component: ConfigHomePageComponent },
          { path: 'sede', component: ConfigBranchPageComponent },
          { path: 'recursos', component: ConfigResourcesPageComponent },
          { path: 'tarifas', component: ConfigPricingPageComponent },
          { path: 'disponibilidad', component: ConfigSchedulePageComponent }
        ]
      }
    ]
  }
];
