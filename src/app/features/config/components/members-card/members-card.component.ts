import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API } from '../../../../core/api/api.config';
import { AuthService, roleLabel } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/ui/toast.service';
import { BackdropClickDirective } from '../../../../shared/directives/backdrop-click.directive';
import { apiErrorMessage } from '../../../../core/utils';

type MemberRole = 'OWNER' | 'ADMIN' | 'CASHIER';
type Member = {
  uuid: string;
  fullName: string;
  email: string;
  role: MemberRole;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
};
/** Datos que el propietario le entrega al empleado. password es null si ya tenia cuenta. */
type Credentials = { fullName: string; email: string; password: string | null; title: string };

const LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/** Clave temporal legible (sin 0/O ni 1/l) con letras y numeros, como exige el backend. */
function temporaryPassword() {
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  let password = pick(LETTERS) + pick(DIGITS);
  while (password.length < 10) password += pick(LETTERS + DIGITS);
  return password;
}

/** Usuarios del parqueadero. Solo el propietario crea admins y cajeros con clave temporal. */
@Component({
  selector: 'members-card',
  standalone: true,
  imports: [CommonModule, FormsModule, BackdropClickDirective],
  templateUrl: './members-card.component.html'
})
export class MembersCardComponent implements OnInit {
  @Input({ required: true }) tenantId = '';

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  members = signal<Member[]>([]);
  loading = signal(true);
  form = signal<{ fullName: string; email: string; role: MemberRole; temporaryPassword: string } | null>(null);
  saving = signal(false);
  credentials = signal<Credentials | null>(null);
  roleLabel = roleLabel;

  ngOnInit() {
    this.load();
  }

  isMe(member: Member) {
    return member.uuid === this.auth.user()?.uuid;
  }

  openAdd() {
    this.form.set({ fullName: '', email: '', role: 'CASHIER', temporaryPassword: temporaryPassword() });
  }

  patchForm(patch: Partial<{ fullName: string; email: string; role: MemberRole; temporaryPassword: string }>) {
    this.form.update(form => form ? { ...form, ...patch } : form);
  }

  regenerate() {
    this.patchForm({ temporaryPassword: temporaryPassword() });
  }

  add() {
    const form = this.form();
    if (!form || this.saving()) return;
    if (!form.fullName.trim()) { this.toast.err('Ingrese el nombre'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { this.toast.err('Ingrese un correo válido'); return; }
    if (form.temporaryPassword.length < 8 || !/[A-Za-z]/.test(form.temporaryPassword) || !/\d/.test(form.temporaryPassword)) {
      this.toast.err('La contraseña temporal debe tener 8+ caracteres, letras y números'); return;
    }
    this.saving.set(true);
    this.http.post<{ member: Member; existingAccount: boolean }>(this.url(), {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      role: form.role,
      temporaryPassword: form.temporaryPassword
    }).subscribe({
      next: ({ member, existingAccount }) => {
        this.saving.set(false);
        this.form.set(null);
        this.load();
        this.credentials.set({
          fullName: member.fullName,
          email: member.email,
          password: existingAccount ? null : form.temporaryPassword,
          title: `${roleLabel(member.role)} agregado`
        });
      },
      error: (err: HttpErrorResponse) => this.fail(err, 'No se pudo agregar el usuario')
    });
  }

  changeRole(member: Member, role: MemberRole) {
    if (role === member.role) return;
    this.http.put<Member>(`${this.url()}/${member.uuid}`, { role }).subscribe({
      next: saved => {
        this.members.update(list => list.map(item => item.uuid === saved.uuid ? saved : item));
        this.toast.ok(`${saved.fullName} ahora es ${roleLabel(saved.role).toLowerCase()}`);
      },
      error: (err: HttpErrorResponse) => { this.load(); this.fail(err, 'No se pudo cambiar el rol'); }
    });
  }

  resetPassword(member: Member) {
    if (!window.confirm(`¿Asignar una nueva contraseña temporal a ${member.fullName}? Se cerrarán sus sesiones abiertas.`)) return;
    const password = temporaryPassword();
    this.http.post<Member>(`${this.url()}/${member.uuid}/reset-password`, { temporaryPassword: password }).subscribe({
      next: saved => {
        this.members.update(list => list.map(item => item.uuid === saved.uuid ? saved : item));
        this.credentials.set({ fullName: saved.fullName, email: saved.email, password, title: 'Contraseña restablecida' });
      },
      error: (err: HttpErrorResponse) => this.fail(err, 'No se pudo restablecer la contraseña')
    });
  }

  remove(member: Member) {
    if (!window.confirm(`¿Quitar el acceso de ${member.fullName} a este parqueadero?`)) return;
    this.http.delete(`${this.url()}/${member.uuid}`).subscribe({
      next: () => {
        this.members.update(list => list.filter(item => item.uuid !== member.uuid));
        this.toast.ok(`${member.fullName} ya no tiene acceso`);
      },
      error: (err: HttpErrorResponse) => this.fail(err, 'No se pudo quitar el acceso')
    });
  }

  copyCredentials() {
    const data = this.credentials();
    if (!data) return;
    const lines = [
      `SP Parqueaderos — ${window.location.origin}`,
      `Usuario: ${data.email}`,
      data.password ? `Contraseña temporal: ${data.password}` : 'Contraseña: la misma que ya usas',
      data.password ? 'Al ingresar te pedirá crear tu propia contraseña.' : ''
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n')).then(
      () => this.toast.ok('Datos de acceso copiados', '📋'),
      () => this.toast.err('No se pudo copiar; anótelos manualmente')
    );
  }

  private load() {
    this.http.get<Member[]>(this.url()).subscribe({
      next: members => { this.members.set(members); this.loading.set(false); },
      error: () => { this.members.set([]); this.loading.set(false); }
    });
  }

  private fail(err: HttpErrorResponse, fallback: string) {
    this.saving.set(false);
    this.toast.err(apiErrorMessage(err, fallback));
  }

  private url() {
    return `${API.tenant}/tenants/${this.tenantId}/members`;
  }
}
