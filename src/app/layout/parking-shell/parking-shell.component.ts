import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ParkingSidebarComponent } from '../parking-sidebar/parking-sidebar.component';

@Component({
  selector: 'parking-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ParkingSidebarComponent],
  templateUrl: './parking-shell.component.html'
})
export class ParkingShellComponent {}
