import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

/**
 * Clic sobre el fondo de un modal. Solo se emite si el clic empezo y termino en el fondo:
 * al seleccionar texto de un campo arrastrando hasta fuera del modal, el navegador entrega
 * el click al fondo y el modal se cerraba.
 */
@Directive({
  selector: '[backdropClick]',
  standalone: true
})
export class BackdropClickDirective {
  @Output() backdropClick = new EventEmitter<MouseEvent>();
  private pressedOnBackdrop = false;

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.pressedOnBackdrop = event.target === event.currentTarget;
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    const releasedOnBackdrop = event.target === event.currentTarget;
    if (this.pressedOnBackdrop && releasedOnBackdrop) this.backdropClick.emit(event);
    this.pressedOnBackdrop = false;
  }
}
