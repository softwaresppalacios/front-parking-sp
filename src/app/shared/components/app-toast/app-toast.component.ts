import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="toast-stack" aria-live="polite" aria-atomic="true">
      <article class="toast-card" [class.toast-card--error]="toast.kind === 'error'" *ngFor="let toast of toastService.toasts()">
        <div class="toast-card__icon">
          <i class="pi" [class.pi-check]="toast.kind === 'success'" [class.pi-times]="toast.kind === 'error'"></i>
        </div>
        <div class="toast-card__copy">
          <strong>{{ toast.title }}</strong>
          <span>{{ toast.detail }}</span>
        </div>
        <button type="button" class="toast-card__close" aria-label="Cerrar alerta" (click)="toastService.dismiss(toast.id)">
          <i class="pi pi-times"></i>
        </button>
      </article>
    </section>
  `
})
export class AppToastComponent {
  toastService = inject(ToastService);
}
