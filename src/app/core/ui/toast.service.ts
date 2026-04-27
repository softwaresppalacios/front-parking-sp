import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error';

export type ToastMessage = {
  id: number;
  kind: ToastKind;
  title: string;
  detail: string;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  toasts = signal<ToastMessage[]>([]);

  success(title: string, detail = 'Accion realizada con exito.') {
    this.show('success', title, detail);
  }

  error(title: string, detail = 'No se pudo completar la accion.') {
    this.show('error', title, detail);
  }

  dismiss(id: number) {
    this.toasts.update(items => items.filter(item => item.id !== id));
  }

  private show(kind: ToastKind, title: string, detail: string) {
    const id = this.nextId++;
    this.toasts.update(items => [...items, { id, kind, title, detail }].slice(-3));
    window.setTimeout(() => this.dismiss(id), 4200);
  }
}
