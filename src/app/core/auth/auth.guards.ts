import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

const CHANGE_PASSWORD_URL = '/cambiar-clave';

/** Solo deja pasar con sesion valida; si no, manda al login recordando a donde iba. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(
    map(ok => {
      if (!ok) return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
      return auth.mustChangePassword() ? router.createUrlTree([CHANGE_PASSWORD_URL]) : true;
    })
  );
};

/** Solo deja abrir un parqueadero al que el usuario tenga acceso. */
export const tenantAccessGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tenantUuid = route.paramMap.get('tenantUuid') || '';
  return auth.ensureSession().pipe(
    map(ok => {
      if (!ok) return router.createUrlTree(['/login']);
      if (auth.mustChangePassword()) return router.createUrlTree([CHANGE_PASSWORD_URL]);
      return auth.hasTenant(tenantUuid) ? true : router.createUrlTree(['/parkings']);
    })
  );
};

/** Cambio de contraseña: basta con tener sesion, aunque la clave sea temporal. */
export const sessionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map(ok => ok ? true : router.createUrlTree(['/login'])));
};

/** Reportes y configuracion solo para propietario o admin; el cajero vuelve al dashboard. */
export const manageGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tenantUuid = route.parent?.paramMap.get('tenantUuid') || '';
  return auth.canManage(tenantUuid) ? true : router.createUrlTree(['/parking', tenantUuid, 'dashboard']);
};

/** Login y registro no tienen sentido con sesion abierta. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map(ok => ok ? router.createUrlTree([auth.homeUrl()]) : true));
};
