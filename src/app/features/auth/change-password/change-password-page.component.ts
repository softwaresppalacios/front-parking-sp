import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';

/** Cambio de contraseña. Obligatorio al entrar con la clave temporal que asigno el propietario. */
@Component({
  selector: 'change-password-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password-page.component.html'
})
export class ChangePasswordPageComponent {
  private router = inject(Router);
  auth = inject(AuthService);
  private toast = inject(ToastService);

  form = { current: '', password: '', confirm: '' };
  error = signal('');
  loading = signal(false);
  leaving = signal(false);
  showPassword = signal(false);

  hasLength() { return this.form.password.length >= 8; }
  hasLetter() { return /[A-Za-z]/.test(this.form.password); }
  hasNumber() { return /\d/.test(this.form.password); }
  matches() { return !!this.form.password && this.form.password === this.form.confirm; }

  save() {
    if (this.loading()) return;
    this.error.set('');
    const message = this.validate();
    if (message) { this.error.set(message); return; }
    this.loading.set(true);
    this.auth.changePassword(this.form.current, this.form.password).subscribe({
      next: () => {
        this.toast.ok('Contraseña actualizada', '🔐');
        this.leaving.set(true);
        window.setTimeout(() => this.router.navigateByUrl(this.auth.homeUrl()), 400);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 0 ? 'No hay conexión con el servicio de autenticación.' : (err.error?.message || 'No se pudo cambiar la contraseña.'));
      }
    });
  }

  cancel() {
    this.router.navigateByUrl(this.auth.homeUrl());
  }

  private validate() {
    if (!this.form.current) return 'Ingresa tu contraseña actual.';
    if (!this.hasLength() || !this.hasLetter() || !this.hasNumber()) return 'La contraseña debe tener mínimo 8 caracteres, con letras y números.';
    if (!this.matches()) return 'Las contraseñas no coinciden.';
    if (this.form.password === this.form.current) return 'La nueva contraseña debe ser diferente a la actual.';
    return '';
  }
}
