import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-cont" aria-live="polite">
      <div class="toast {{ toast.kind }}" [class.leaving]="toast.leaving" *ngFor="let toast of toastService.toasts()">
        <span class="toast-icon">{{ toast.icon }}</span>
        <span class="toast-text">{{ toast.text }}</span>
      </div>
    </div>
  `
})
export class AppToastComponent {
  toastService = inject(ToastService);
}
