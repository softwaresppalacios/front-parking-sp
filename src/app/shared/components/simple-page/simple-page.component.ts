import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'simple-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-head"><h1>{{ title }}</h1></header>
    <section class="panel"><p>{{ text }}</p></section>
  `
})
export class SimplePageComponent {
  private route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'] || 'Modulo';
  text = 'Modulo listo para conectar reglas especificas del negocio.';
}
