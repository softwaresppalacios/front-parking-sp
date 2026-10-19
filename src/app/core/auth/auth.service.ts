import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { API } from '../api/api.config';
import { readStorage, writeStorage } from '../utils';

export type SessionUser = { uuid: string; fullName: string; email: string; mustChangePassword?: boolean };
export type TenantAccess = { uuid: string; name: string; role: 'OWNER' | 'ADMIN' | 'CASHIER'; status: string; planName: string; branchLimit: number; branchCount: number };
export type Session = { token: string; expiresAt: string; user: SessionUser; tenants: TenantAccess[] };
export type RegisterData = { fullName: string; email: string; password: string; parkingName: string; branchAddress?: string };

const STORAGE_KEY = 'sp_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  /** true cuando el token ya se valido contra el servidor en esta carga de la app. */
  private verified = false;

  session = signal<Session | null>(this.restore());
  user = computed(() => this.session()?.user || null);
  tenants = computed(() => this.session()?.tenants || []);
  isLoggedIn = computed(() => !!this.session());
  /** La cuenta tiene una clave temporal asignada por el propietario. */
  mustChangePassword = computed(() => !!this.session()?.user.mustChangePassword);

  login(email: string, password: string): Observable<Session> {
    return this.http.post<Session>(`${API.tenant}/auth/login`, { email: email.trim(), password }).pipe(tap(session => this.store(session)));
  }

  register(data: RegisterData): Observable<Session> {
    return this.http.post<Session>(`${API.tenant}/auth/register`, {
      ...data,
      fullName: data.fullName.trim(),
      email: data.email.trim(),
      parkingName: data.parkingName.trim(),
      branchAddress: data.branchAddress?.trim() || null
    }).pipe(tap(session => this.store(session)));
  }

  /** Valida el token con el servidor (una vez por carga) y actualiza los parqueaderos del usuario. */
  ensureSession(): Observable<boolean> {
    const current = this.session();
    if (!current) return of(false);
    if (this.isExpired(current)) { this.clear(); return of(false); }
    if (this.verified) return of(true);
    return this.refresh().pipe(map(() => !!this.session()));
  }

  refresh(): Observable<void> {
    return this.http.get<{ user: SessionUser; tenants: TenantAccess[] }>(`${API.tenant}/auth/me`).pipe(
      tap(me => {
        const current = this.session();
        if (current) this.store({ ...current, user: me.user, tenants: me.tenants });
        this.verified = true;
      }),
      map(() => undefined),
      catchError(() => { this.clear(); return of(undefined); })
    );
  }

  /** El servidor cierra las demas sesiones; la actual sigue valida. */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${API.tenant}/auth/change-password`, { currentPassword, newPassword }).pipe(
      tap(() => {
        const current = this.session();
        if (current) this.store({ ...current, user: { ...current.user, mustChangePassword: false } });
      })
    );
  }

  logout(): void {
    const token = this.session()?.token;
    this.clear();
    if (token) {
      this.http.post(`${API.tenant}/auth/logout`, null, { headers: { Authorization: `Bearer ${token}` } }).subscribe({ error: () => undefined });
    }
    this.router.navigateByUrl('/login');
  }

  /** Limpia la sesion local cuando el servidor la rechaza. */
  expire(): void {
    this.clear();
    this.router.navigate(['/login'], { queryParams: { expirada: 1 } });
  }

  hasTenant(uuid: string) {
    return this.tenants().some(tenant => tenant.uuid === uuid);
  }

  role(uuid: string) {
    return this.tenants().find(tenant => tenant.uuid === uuid)?.role || null;
  }

  /** Propietario y admin gestionan reportes y configuracion; el cajero solo opera. */
  canManage(uuid: string) {
    const role = this.role(uuid);
    return role === 'OWNER' || role === 'ADMIN';
  }

  /** Ruta de inicio despues de entrar: el dashboard si solo tiene un parqueadero. */
  homeUrl() {
    if (this.mustChangePassword()) return '/cambiar-clave';
    const tenants = this.tenants();
    return tenants.length === 1 ? `/parking/${tenants[0].uuid}/dashboard` : '/parkings';
  }

  private store(session: Session) {
    this.verified = true;
    this.session.set(session);
    writeStorage(STORAGE_KEY, session);
  }

  private clear() {
    this.verified = false;
    this.session.set(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* almacenamiento no disponible */ }
  }

  private restore(): Session | null {
    const stored = readStorage<Session | null>(STORAGE_KEY, null);
    // Sesiones del login de demo anterior (sin token real) se descartan.
    if (!stored?.token || !stored.user || !stored.expiresAt || this.isExpired(stored)) return null;
    return stored;
  }

  private isExpired(session: Session) {
    return new Date(session.expiresAt).getTime() <= Date.now();
  }
}

export function roleLabel(role: string | null) {
  return ({ OWNER: 'PROPIETARIO', ADMIN: 'ADMIN', CASHIER: 'CAJERO' } as Record<string, string>)[role || ''] || 'USUARIO';
}
