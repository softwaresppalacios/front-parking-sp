import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ConfigSummaryCardComponent } from '../components/config-summary-card/config-summary-card.component';
import { ConfigSectionCardComponent } from '../components/config-section-card/config-section-card.component';
import { ConfigStore } from '../store/config.store';

@Component({
  selector: 'config-home-page',
  standalone: true,
  imports: [CommonModule, ConfigSummaryCardComponent, ConfigSectionCardComponent],
  templateUrl: './config-home-page.component.html',
  styleUrls: ['./config-home-page.component.css']
})
export class ConfigHomePageComponent {
  store = inject(ConfigStore);

  summaryCards() {
    const config = this.store.branchConfig();
    return [
      {
        label: 'Capacidad carros',
        value: config.carCapacity,
        unit: 'puestos',
        icon: 'C',
        description: 'Espacios habilitados para vehiculos tipo carro.',
        badge: 'Operacion vehicular',
        accentBar: 'bg-gradient-to-r from-rose-500 via-red-500 to-orange-400',
        surface: '',
        orb: '',
        iconWrap: '',
        unitClass: 'text-rose-600',
        badgeClass: 'border-rose-200/80 bg-white/75 text-rose-700'
      },
      {
        label: 'Capacidad motos',
        value: config.motorcycleCapacity,
        unit: 'puestos',
        icon: 'M',
        description: 'Cupos disponibles para motos dentro de la sede.',
        badge: 'Alta rotacion',
        accentBar: 'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400',
        surface: '',
        orb: '',
        iconWrap: '',
        unitClass: 'text-pink-600',
        badgeClass: 'border-pink-200/80 bg-white/75 text-pink-700'
      },
      {
        label: 'Tablero llaves',
        value: config.keyRackCapacity,
        unit: 'slots',
        icon: 'L',
        description: 'Capacidad total del tablero para custodia de llaves.',
        badge: 'Control interno',
        accentBar: 'bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400',
        surface: '',
        orb: '',
        iconWrap: '',
        unitClass: 'text-sky-600',
        badgeClass: 'border-sky-200/80 bg-white/75 text-sky-700'
      },
      {
        label: 'Casilleros cascos',
        value: config.helmetLockerCapacity,
        unit: 'slots',
        icon: 'H',
        description: 'Espacios asignables para almacenamiento de cascos.',
        badge: 'Servicio cliente',
        accentBar: 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300',
        surface: '',
        orb: '',
        iconWrap: '',
        unitClass: 'text-amber-600',
        badgeClass: 'border-amber-200/80 bg-white/75 text-amber-700'
      }
    ];
  }

  sections() {
    const config = this.store.branchConfig();
    return [
      {
        title: 'Configuracion sede',
        description: 'Edita nombre, NIT, telefono y direccion de la sede principal.',
        summary: `${config.name || 'Sin nombre'} · ${config.phone || 'Sin telefono'}`,
        route: 'sede',
        tag: 'Datos base',
        icon: 'pi pi-building'
      },
      {
        title: 'Recursos del parqueadero',
        description: 'Ajusta capacidades de carros, motos, llaves y cascos.',
        summary: `${config.carCapacity} carros · ${config.motorcycleCapacity} motos`,
        route: 'recursos',
        tag: 'Capacidad',
        icon: 'pi pi-box'
      },
      {
        title: 'Reglas de cobro por vehiculo',
        description: 'Configura tarifas, topes diarios y modelo de cobro.',
        summary: `${this.store.pricingRules().length} reglas activas`,
        route: 'tarifas',
        tag: 'Tarifas',
        icon: 'pi pi-receipt'
      },
      {
        title: 'Disponibilidad semanal',
        description: 'Define horarios de apertura y cierre para cada dia.',
        summary: `${this.store.openDays()} dias abiertos · ${this.store.closedDays()} cerrados`,
        route: 'disponibilidad',
        tag: 'Horarios',
        icon: 'pi pi-calendar-clock'
      }
    ];
  }
}
