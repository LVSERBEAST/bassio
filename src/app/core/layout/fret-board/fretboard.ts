import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Note {
  id: string;
  string: number; // 0-3 (E, A, D, G)
  fret: number;
  position: number; // 0-100, right to left
  color: string;
}

@Component({
  selector: 'fretboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fretboard.html',
  styleUrls: ['./fretboard.scss'],
})
export class Fretboard {
  strings = ['G', 'D', 'A', 'E'];
  frets = Array.from({ length: 13 }, (_, i) => i);
  
  notes = signal<Note[]>([]);
  isPlaying = signal(false);
  tempo = signal(120); // BPM

  visibleFrets = computed(() => this.frets.slice(0, 5)); // Show first 5 frets

  playNote(stringIndex: number, fret: number) {
    const note: Note = {
      id: `${Date.now()}-${stringIndex}-${fret}`,
      string: stringIndex,
      fret,
      position: 100, // Start from right
      color: '#ee9800'
    };
    
    this.notes.update(notes => [...notes, note]);
    
    // Animate note moving left
    const interval = setInterval(() => {
      this.notes.update(notes => {
        const updated = notes.map(n => 
          n.id === note.id ? { ...n, position: n.position - 2 } : n
        );
        return updated.filter(n => n.position > -10);
      });
      
      if (note.position <= 0) {
        clearInterval(interval);
      }
    }, 16);
  }

  playSequence(sequence: Array<{ string: number; fret: number }>) {
    const beatDuration = (60 / this.tempo()) * 1000;
    
    sequence.forEach((note, index) => {
      setTimeout(() => {
        this.playNote(note.string, note.fret);
      }, beatDuration * index);
    });
  }

  clearNotes() {
    this.notes.set([]);
  }
}