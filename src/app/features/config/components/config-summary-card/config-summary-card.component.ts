import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'config-summary-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './config-summary-card.component.html',
  styleUrls: ['./config-summary-card.component.css']
})
export class ConfigSummaryCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  @Input({ required: true }) unit = '';
  @Input({ required: true }) icon = '';
  @Input({ required: true }) description = '';
  @Input({ required: true }) badge = '';
  @Input({ required: true }) accentBar = '';
  @Input({ required: true }) surface = '';
  @Input({ required: true }) orb = '';
  @Input({ required: true }) iconWrap = '';
  @Input({ required: true }) unitClass = '';
  @Input({ required: true }) badgeClass = '';
}
