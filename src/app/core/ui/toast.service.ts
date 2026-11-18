import { Injectable, signal } from '@angular/core';

export type ToastKind = 'ok' | 'err' | 'info';

export type ToastMessage = {
  id: number;
  kind: ToastKind;
  icon: string;
  text: string;
  leaving: boolean;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  toasts = signal<ToastMessage[]>([]);

  ok(text: string, icon = '✓') { this.show('ok', icon, text); }
  err(text: string, icon = '⚠️') { this.show('err', icon, text); }
  info(text: string, icon = 'ℹ️') { this.show('info', icon, text); }

  show(kind: ToastKind, icon: string, text: string) {
    const id = this.nextId++;
    this.toasts.update(items => [...items, { id, kind, icon, text, leaving: false }].slice(-4));
    window.setTimeout(() => {
      this.toasts.update(items => items.map(item => item.id === id ? { ...item, leaving: true } : item));
      window.setTimeout(() => this.toasts.update(items => items.filter(item => item.id !== id)), 300);
    }, 3500);
  }
}
