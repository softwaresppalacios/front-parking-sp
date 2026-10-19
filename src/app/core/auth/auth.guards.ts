import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/** Solo deja pasar con sesion valida; si no, manda al login recordando a donde iba. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(
    map(ok => ok ? true : router.createUrlTree(['/login'], { queryParams: { volver: state.url } }))
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
      return auth.hasTenant(tenantUuid) ? true : router.createUrlTree(['/parkings']);
    })
  );
};

/** Login y registro no tienen sentido con sesion abierta. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map(ok => ok ? router.createUrlTree([auth.homeUrl()]) : true));
};
