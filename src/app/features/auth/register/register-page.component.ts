import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'register-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-page.component.html'
})
export class RegisterPageComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  form = { fullName: '', email: '', password: '', confirm: '', parkingName: '', branchAddress: '' };
  error = signal('');
  loading = signal(false);
  leaving = signal(false);

  hasLength() { return this.form.password.length >= 8; }
  hasLetter() { return /[A-Za-z]/.test(this.form.password); }
  hasNumber() { return /\d/.test(this.form.password); }
  matches() { return !!this.form.password && this.form.password === this.form.confirm; }

  register() {
    if (this.loading()) return;
    this.error.set('');
    const message = this.validate();
    if (message) { this.error.set(message); return; }
    this.loading.set(true);
    this.auth.register({
      fullName: this.form.fullName,
      email: this.form.email,
      password: this.form.password,
      parkingName: this.form.parkingName,
      branchAddress: this.form.branchAddress
    }).subscribe({
      next: session => {
        this.toast.ok(`Cuenta creada. ¡Bienvenido, ${session.user.fullName.split(' ')[0]}!`, '🎉');
        this.leaving.set(true);
        window.setTimeout(() => this.router.navigateByUrl(this.auth.homeUrl()), 400);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 0 ? 'No hay conexión con el servicio de autenticación.' : (err.error?.message || 'No se pudo crear la cuenta.'));
      }
    });
  }

  private validate() {
    if (!this.form.fullName.trim()) return 'Ingresa tu nombre completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())) return 'Ingresa un correo válido.';
    if (!this.hasLength() || !this.hasLetter() || !this.hasNumber()) return 'La contraseña debe tener mínimo 8 caracteres, con letras y números.';
    if (!this.matches()) return 'Las contraseñas no coinciden.';
    if (!this.form.parkingName.trim()) return 'Ingresa el nombre de tu parqueadero.';
    return '';
  }
}
