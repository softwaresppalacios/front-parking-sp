import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API } from '../../../core/api/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login-page.component.html'
})
export class LoginPageComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  leaving = signal(false);
  online = signal(true);
  showPassword = signal(false);

  constructor() {
    // Cualquier respuesta HTTP (incluido 401 sin sesion) indica que el servidor esta en linea.
    this.http.get(`${API.tenant}/auth/me`).subscribe({ next: () => this.online.set(true), error: error => this.online.set(error.status !== 0) });
    if (this.route.snapshot.queryParamMap.get('expirada')) {
      this.error.set('Tu sesión expiró. Inicia sesión de nuevo.');
    }
  }

  forgotPassword() {
    this.toast.info('Escríbenos a info@spparqueaderos.co para restablecer tu contraseña', '✉️');
  }

  login() {
    if (this.loading()) return;
    this.error.set('');
    if (!this.email.trim() || !this.password) {
      this.error.set('Ingresa tu correo y contraseña.');
      return;
    }
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: session => {
        this.toast.ok(`Bienvenido, ${session.user.fullName.split(' ')[0]}`, '👋');
        this.leaving.set(true);
        const target = this.route.snapshot.queryParamMap.get('volver') || this.auth.homeUrl();
        window.setTimeout(() => this.router.navigateByUrl(target), 400);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 0 ? 'No hay conexión con el servicio de autenticación.' : (err.error?.message || 'No se pudo iniciar sesión.'));
      }
    });
  }
}
