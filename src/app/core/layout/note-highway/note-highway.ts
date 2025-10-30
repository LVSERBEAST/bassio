import { Component, signal, computed, inject } from '@angular/core';
import { Sequencer } from '../../services/sequencer';

@Component({
  selector: 'note-highway',
  standalone: true,
  imports: [],
  templateUrl: './note-highway.html',
  styleUrls: ['./note-highway.scss'],
  host: {
    '(document:mousemove)': 'onDrag($event)',
    '(document:mouseup)': 'onDragEnd()',
  },
})
export class NoteHighway {
  sequencer = inject(Sequencer);
  protected readonly strings = ['E', 'A', 'D', 'G']
  protected readonly notes = computed(() => this.sequencer.notes());
  private readonly isDragging = signal(false);
  protected readonly hitZonePosition = computed(() => this.sequencer.hitZonePosition());
  protected readonly beatGrid = computed(() => this.sequencer.beatMarkers());
  protected readonly beatDuration = computed(() => 60 / this.sequencer.tempo.bpm());

  protected onDragStart(event: MouseEvent): void {
    if (this.sequencer.isPlaying()) return;
    this.isDragging.set(true);
    event.preventDefault();
  }

  protected onDrag(event: MouseEvent): void {
    if (!this.isDragging() || this.sequencer.isPlaying()) return;

    const container = document.querySelector('.highway-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    this.sequencer.hitZonePosition.set(Math.max(10, Math.min(90, percent)));
  }

  protected onDragEnd(): void {
    this.isDragging.set(false);
  }
}