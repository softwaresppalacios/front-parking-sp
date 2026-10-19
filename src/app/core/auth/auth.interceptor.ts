import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API } from '../api/api.config';
import { AuthService } from './auth.service';

/** Envia el token de sesion al servicio de tenants y cierra la sesion local si el servidor la rechaza. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.session()?.token;
  const isTenantApi = request.url.startsWith(API.tenant);
  const isAuthEntry = /\/auth\/(login|register|logout)$/.test(request.url);
  const outgoing = token && isTenantApi && !request.headers.has('Authorization')
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isTenantApi && !isAuthEntry && token) auth.expire();
      return throwError(() => error);
    })
  );
};
