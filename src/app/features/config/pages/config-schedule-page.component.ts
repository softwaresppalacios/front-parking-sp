import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { dayLabel } from '../../../core/utils';
import { ConfigStore } from '../store/config.store';

@Component({
  selector: 'config-schedule-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './config-schedule-page.component.html',
  styleUrls: ['./config-schedule-page.component.css']
})
export class ConfigSchedulePageComponent {
  store = inject(ConfigStore);

  dayLabel(day: string) { return dayLabel(day); }
}
