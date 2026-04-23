import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { API } from '../../../core/api/api.config';

@Component({
  selector: 'login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, PasswordModule],
  templateUrl: './login-page.component.html'
})
export class LoginPageComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  email = 'admin@spparqueaderos.com';
  password = 'admin123';
  error = signal('');

  demo() {
    this.email = 'admin@spparqueaderos.com';
    this.password = 'admin123';
    this.login();
  }

  login() {
    this.http.post<{ token: string; userName: string }>(`${API.tenant}/auth/login`, { email: this.email, password: this.password })
      .subscribe({
        next: session => {
          localStorage.setItem('sp_session', JSON.stringify(session));
          this.router.navigateByUrl('/parkings');
        },
        error: () => this.error.set('Credenciales invalidas o servicio no disponible.')
      });
  }
}
