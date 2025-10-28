import { Injectable, signal, computed, inject } from '@angular/core';
import { Metronome } from './metronome';

export interface Note {
  id: string;
  string: number;
  fret: number;
  position: number;
  active: boolean;
  state: 'approaching' | 'hit' | 'miss' | 'perfect';
}

export interface Pattern {
  notes: Array<{ string: number; fret: number; beat: number }>;
  bpm: number;
}

@Injectable({ providedIn: 'root' })
export class Player {
  private readonly metronome = inject(Metronome);
  readonly notes = signal<Note[]>([]);
  readonly isPlaying = signal(false);
  readonly countdown = signal(0);
  readonly hitZoneFlash = signal(false);
  readonly beatMarkers = signal<Array<{ position: number; id: string }>>([]);
  hitZonePosition = signal(15);

  private rafId: number | null = null;
  private readonly pixelsPerSecond = 20; // Slower scroll

  async playPattern(pattern: Pattern, hitZonePosition: number): Promise<void> {
    this.clear();

    // Count-off with metronome if active
    if (this.metronome.isActive()) {
      this.metronome.setBpm(pattern.bpm);

      // 1-2-1-2-3-4 count
      const beatDuration = (60 / pattern.bpm) * 1000;

      this.metronome.start();
      for (let i = 0; i < 6; i++) {
        await this.delay(beatDuration);
      }
    } else {
      // Regular countdown without metronome
      for (let i = 3; i > 0; i--) {
        this.countdown.set(i);
        await this.delay(1000);
      }
      this.countdown.set(0);
    }

    this.spawnNotes(pattern, hitZonePosition);
    this.start();
  }

  stop(): void {
    this.isPlaying.set(false);
    this.metronome.stop();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clear();
  }

  checkHit(detectedString: number, detectedFret: number, hitZonePos: number): void {
    const tolerance = 5; // 5% tolerance

    this.notes.update((notes) =>
      notes.map((note) => {
        if (note.state !== 'approaching') return note;

        const inZone = Math.abs(note.position - hitZonePos) < tolerance;
        const correctNote = note.string === detectedString && note.fret === detectedFret;

        if (inZone && correctNote) {
          this.flashHitZone();
          return { ...note, state: 'perfect' as const };
        }
        return note;
      })
    );
  }

  private spawnNotes(pattern: Pattern, hitZonePosition: number): void {
    const beatDuration = (60 / pattern.bpm) * 1000;
    const pixelsPerBeat = this.pixelsPerSecond * (beatDuration / 1000);

    // Spawn beat markers
    const markers = [];
    for (let i = 0; i < 50; i++) {
      markers.push({
        id: `marker-${i}`,
        position: 100 + i * pixelsPerBeat * 4, // Every 4 beats (1 measure)
      });
    }
    this.beatMarkers.set(markers);

    // Spawn notes
    pattern.notes.forEach(({ string, fret, beat }) => {
      const note: Note = {
        id: `${Date.now()}-${string}-${fret}-${beat}`,
        string,
        fret,
        position: 100,
        active: true,
        state: 'approaching',
      };

      const travelDistance = 100 - hitZonePosition;
      const travelTime = (travelDistance / this.pixelsPerSecond) * 1000;
      const spawnDelay = beat * beatDuration - travelTime;

      setTimeout(() => {
        this.notes.update((notes) => [...notes, note]);
      }, Math.max(0, spawnDelay));
    });
  }

  private start(): void {
    if (this.isPlaying()) return;
    this.isPlaying.set(true);
    this.animate();
  }

  private clear(): void {
    this.notes.set([]);
    this.countdown.set(0);
  }

  private animate(): void {
    if (!this.isPlaying()) return;

    const deltaTime = 1 / 60;
    const pixelsToMove = this.pixelsPerSecond * deltaTime;

    // Update notes
    this.notes.update((notes) =>
      notes
        .map((n) => {
          const newPos = n.position - pixelsToMove;

          if (n.state === 'approaching' && newPos < 10) {
            return { ...n, position: newPos, state: 'miss' as const };
          }

          return { ...n, position: newPos };
        })
        .filter((n) => n.position > -10)
    );

    // Update beat markers
    this.beatMarkers.update((markers) =>
      markers
        .map((m) => ({ ...m, position: m.position - pixelsToMove }))
        .filter((m) => m.position > -10)
    );

    this.rafId = requestAnimationFrame(() => this.animate());
  }

  private flashHitZone(): void {
    this.hitZoneFlash.set(true);
    setTimeout(() => this.hitZoneFlash.set(false), 100);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
