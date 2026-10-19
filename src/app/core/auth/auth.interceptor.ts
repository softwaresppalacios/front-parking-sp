import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API } from '../api/api.config';
import { AuthService } from './auth.service';

const API_URLS: string[] = Object.values(API);

/** Envia el token de sesion a todos los microservicios y cierra la sesion local si el servidor la rechaza. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.session()?.token;
  const isOwnApi = API_URLS.some(url => request.url.startsWith(url));
  const isAuthEntry = /\/auth\/(login|register|logout)$/.test(request.url);
  const outgoing = token && isOwnApi && !request.headers.has('Authorization')
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isOwnApi && !isAuthEntry && token) auth.expire();
      return throwError(() => error);
    })
  );
};
