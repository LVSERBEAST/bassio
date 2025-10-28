import { Component, signal, computed, inject } from '@angular/core';
import { Player } from '../../services/player';
import { AudioInput } from '../../services/audio-input';

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
  audioInput = inject(AudioInput);
  player = inject(Player);
  protected readonly strings = ['G', 'D', 'A', 'E'];
  protected readonly notes = computed(() => this.player.notes());
  private readonly isDragging = signal(false);
  protected readonly hitZonePosition = computed(() => this.player.hitZonePosition());
  protected readonly beatGrid = computed(() => this.player.beatMarkers());

  protected onDragStart(event: MouseEvent): void {
    this.isDragging.set(true);
    event.preventDefault();
  }

  protected onDrag(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const container = document.querySelector('.highway-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    this.player.hitZonePosition.set(Math.max(10, Math.min(90, percent)));
  }

  protected onDragEnd(): void {
    this.isDragging.set(false);
  }
}
