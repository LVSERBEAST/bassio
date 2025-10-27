import { Component, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Note {
  id: string;
  string: number;
  fret: number;
  position: number;
  active: boolean;
}

@Component({
  selector: 'note-highway',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './note-highway.html',
  styleUrls: ['./note-highway.scss'],
  host: {
    '(document:mousemove)': 'onDrag($event)',
    '(document:mouseup)': 'onDragEnd()'
  }
})
export class NoteHighway {
  strings = ['G', 'D', 'A', 'E'];
  notes = signal<Note[]>([]);
  isPlaying = signal(false);
  scrollSpeed = signal(2);
  
  hitZonePosition = signal(15);
  isDragging = signal(false);

  onDragStart(event: MouseEvent) {
    this.isDragging.set(true);
    event.preventDefault();
  }

  onDrag(event: MouseEvent) {
    if (!this.isDragging()) return;
    
    const container = document.querySelector('.highway-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    this.hitZonePosition.set(Math.max(10, Math.min(90, percent)));
  }

  onDragEnd() {
    this.isDragging.set(false);
  }

  playNote(stringIndex: number, fret: number) {
    const note: Note = {
      id: `${Date.now()}-${stringIndex}-${fret}`,
      string: stringIndex,
      fret,
      position: 100,
      active: true
    };
    this.notes.update(notes => [...notes, note]);
  }

  playSequence(sequence: Array<{ string: number; fret: number; delay: number }>) {
    sequence.forEach(({ string, fret, delay }) => {
      setTimeout(() => this.playNote(string, fret), delay);
    });
  }

  startAnimation() {
    this.isPlaying.set(true);
    const animate = () => {
      if (!this.isPlaying()) return;
      
      this.notes.update(notes => 
        notes
          .map(n => ({ ...n, position: n.position - this.scrollSpeed() }))
          .filter(n => n.position > -10)
      );
      
      requestAnimationFrame(animate);
    };
    animate();
  }

  stopAnimation() {
    this.isPlaying.set(false);
  }

  clear() {
    this.notes.set([]);
  }
}