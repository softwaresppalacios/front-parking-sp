import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppToastComponent } from './shared/components/app-toast/app-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppToastComponent],
  template: '<router-outlet /><app-toast />'
})
export class AppComponent {}
