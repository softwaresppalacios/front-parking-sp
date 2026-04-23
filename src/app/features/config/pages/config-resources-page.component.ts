import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfigSummaryCardComponent } from '../components/config-summary-card/config-summary-card.component';
import { ConfigStore } from '../store/config.store';

@Component({
  selector: 'config-resources-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfigSummaryCardComponent],
  templateUrl: './config-resources-page.component.html',
  styleUrls: ['./config-resources-page.component.css']
})
export class ConfigResourcesPageComponent {
  store = inject(ConfigStore);

  summaryCards() {
    const config = this.store.branchConfig();
    return [
      { label: 'Capacidad carros', value: config.carCapacity, unit: 'puestos', icon: 'C', description: 'Espacios disponibles para carros.', badge: 'Operacion', accentBar: 'bg-gradient-to-r from-rose-500 to-red-500', surface: '', orb: '', iconWrap: '', unitClass: 'text-rose-600', badgeClass: 'border-rose-200/80 bg-white/75 text-rose-700' },
      { label: 'Capacidad motos', value: config.motorcycleCapacity, unit: 'puestos', icon: 'M', description: 'Espacios disponibles para motos.', badge: 'Rotacion', accentBar: 'bg-gradient-to-r from-pink-500 to-rose-500', surface: '', orb: '', iconWrap: '', unitClass: 'text-pink-600', badgeClass: 'border-pink-200/80 bg-white/75 text-pink-700' },
      { label: 'Tablero llaves', value: config.keyRackCapacity, unit: 'slots', icon: 'L', description: 'Slots para custodia de llaves.', badge: 'Interno', accentBar: 'bg-gradient-to-r from-sky-500 to-cyan-500', surface: '', orb: '', iconWrap: '', unitClass: 'text-sky-600', badgeClass: 'border-sky-200/80 bg-white/75 text-sky-700' },
      { label: 'Casilleros cascos', value: config.helmetLockerCapacity, unit: 'slots', icon: 'H', description: 'Slots para almacenamiento de cascos.', badge: 'Cliente', accentBar: 'bg-gradient-to-r from-amber-400 to-orange-400', surface: '', orb: '', iconWrap: '', unitClass: 'text-amber-600', badgeClass: 'border-amber-200/80 bg-white/75 text-amber-700' }
    ];
  }
}
