import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfigStore } from '../store/config.store';

@Component({
  selector: 'config-branch-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './config-branch-page.component.html'
})
export class ConfigBranchPageComponent {
  store = inject(ConfigStore);
}
