import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ParkingContextService } from '../../core/state/parking-context.service';
import { ParkingSidebarComponent } from '../parking-sidebar/parking-sidebar.component';

@Component({
  selector: 'parking-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, ParkingSidebarComponent],
  templateUrl: './parking-shell.component.html'
})
export class ParkingShellComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private context = inject(ParkingContextService);
  title = signal('Dashboard');
  clock = signal('—');

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => this.context.load(params.get('tenantUuid') || ''));
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.updateTitle());
    this.updateTitle();
    this.updateClock();
    const timer = window.setInterval(() => this.updateClock(), 1000);
    destroyRef.onDestroy(() => window.clearInterval(timer));
  }

  private updateTitle() {
    let snapshot = this.router.routerState.snapshot.root;
    while (snapshot.firstChild) snapshot = snapshot.firstChild;
    this.title.set(snapshot.data?.['title'] || 'Dashboard');
  }

  private updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = now.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
    this.clock.set(`${date} · ${time}`);
  }
}
