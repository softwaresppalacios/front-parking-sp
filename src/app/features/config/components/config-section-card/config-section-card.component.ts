import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'config-section-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './config-section-card.component.html',
  styleUrls: ['./config-section-card.component.css']
})
export class ConfigSectionCardComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) description = '';
  @Input({ required: true }) summary = '';
  @Input({ required: true }) route = '';
  @Input({ required: true }) tag = '';
  @Input() icon = 'pi pi-cog';
}
