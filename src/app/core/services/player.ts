import { Injectable, signal, computed, inject } from '@angular/core';
import { Metronome } from './metronome';

export interface Note {
  id: string;
  string: number;
  fret: number;
  position: number;
  spawnBeat: number; // NEW
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
  readonly beatMarkers = signal<Array<{ position: number; id: string; measureNumber: number }>>([]);
  hitZonePosition = signal(15);
  private audioContext = new AudioContext();
  private exerciseStartTime = 0;
  private readonly pixelsPerBeat = 50;
  private lastFrameTime = 0;

  private rafId: number | null = null;
  private readonly pixelsPerSecond = 20; // Slower scroll

  async playPattern(pattern: Pattern, hitZonePosition: number): Promise<void> {
    this.clear();
    const beatDuration = (60 / pattern.bpm) * 1000;

    if (this.metronome.isActive()) {
      this.metronome.startCountOff(pattern.bpm);
      const beatDuration = (60 / pattern.bpm) * 1000;

      // Beat 1: click, no visual
      await this.delay(beatDuration);

      // Beat 2: silence
      await this.delay(beatDuration);

      // Beat 3: click + "3"
      this.countdown.set(3);
      await this.delay(beatDuration);

      // Beat 4: silence
      await this.delay(beatDuration);

      // Beat 5: click + "2"
      this.countdown.set(2);
      await this.delay(beatDuration);

      // Beat 6: click + "1"
      this.countdown.set(1);
      await this.delay(beatDuration);

      // Beat 7: click + "Go!"
      this.countdown.set(-1);
      await this.delay(beatDuration);

      // Beat 8: click, clear visual
      this.countdown.set(0);
      await this.delay(beatDuration);
    } else {
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
    const pixelsPerBeat = this.pixelsPerBeat;
    const leadInBeats = 8;

    // Spawn beat markers - store measure number instead of position
    const markers = [];
    for (let i = 0; i < 50; i++) {
      markers.push({
        id: `marker-${i}`,
        measureNumber: i * 4, // Store beat number, not position
        position: hitZonePosition + (i * 4 + leadInBeats) * pixelsPerBeat,
      });
    }
    this.beatMarkers.set(markers);

    // Spawn all notes with spawnBeat
    const notes = pattern.notes.map(({ string, fret, beat }) => ({
      id: `${Date.now()}-${string}-${fret}-${beat}`,
      string,
      fret,
      spawnBeat: beat,
      position: hitZonePosition + (beat + leadInBeats) * pixelsPerBeat,
      active: true,
      state: 'approaching' as const,
    }));

    this.notes.set(notes);
  }

  private start(): void {
    if (this.isPlaying()) return;
    this.lastFrameTime = 0;
    this.exerciseStartTime = this.audioContext.currentTime;
    this.isPlaying.set(true);
    this.animate();
  }

  private clear(): void {
    this.notes.set([]);
    this.countdown.set(0);
  }

  private animate(): void {
    if (!this.isPlaying()) return;

    const now = performance.now();
    const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0;
    this.lastFrameTime = now;

    const pixelsToMove = this.pixelsPerSecond * deltaTime;

    // Update notes
    this.notes.update((notes) =>
      notes
        .map((n) => {
          const newPos = n.position - pixelsToMove;

          if (n.state === 'approaching' && newPos < this.hitZonePosition() - 2) {
            return { ...n, position: newPos, state: 'miss' as const };
          }

          return { ...n, position: newPos };
        })
        .filter((n) => n.position > -20)
    );

    // Update beat markers
    this.beatMarkers.update((markers) =>
      markers
        .map((m) => ({ ...m, position: m.position - pixelsToMove }))
        .filter((m) => m.position > -20 && m.position < 120)
    );

    this.rafId = requestAnimationFrame(() => this.animate());
  }

  private getCurrentBpm(): number {
    // Get from metronome or last pattern
    return this.metronome.bpm();
  }

  private flashHitZone(): void {
    this.hitZoneFlash.set(true);
    setTimeout(() => this.hitZoneFlash.set(false), 100);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
