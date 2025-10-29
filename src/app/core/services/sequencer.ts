import { Injectable, signal, computed, inject, effect, DestroyRef } from '@angular/core';
import { Audio } from './audio';
import { Tempo } from './tempo';
import { AudioInput } from './audio-input';

export interface Note {
  id: string;
  string: number;
  fret: number;
  position: number;
  spawnBeat: number;
  duration?: number;
  sustainStarted?: boolean;
  sustainHitting?: boolean;
  active: boolean;
  state: 'approaching' | 'hit' | 'miss' | 'perfect';
}

export interface Sequence {
  notes: Array<{
    string: number;
    fret: number;
    beat: number;
    duration?: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class Sequencer {
  private readonly audio = inject(Audio);
  private readonly tempo = inject(Tempo);
  private readonly audioInput = inject(AudioInput);

  readonly notes = signal<Note[]>([]);
  readonly isPlaying = signal(false);
  readonly hitZoneFlash = signal(false);
  readonly beatMarkers = signal<Array<{ position: number; id: string; beatNumber: number }>>([]);
  readonly hitZonePosition = signal(15);
  private readonly currentBeat = signal(0);
  private pendingSequence: Sequence['notes'] | null = null;

  private lastNoteBeat = 0;
  readonly pixelsPerBeat = signal(0);
  private lastFrameTime = 0;
  private rafId: number | null = null;
  private readonly entranceTolerance = 5;
  private readonly exitTolerance = 8;

  readonly countdownDisplay = computed(() => {
    const beat = this.currentBeat();
    if (beat >= -8 && beat < -6) return '3';
    if (beat >= -6 && beat < -4) return '2';
    if (beat >= -4 && beat < -2) return '1';
    if (beat >= -2 && beat < 0) return 'Go!';
    return null;
  });

  constructor() {
    effect(() => {
      const detected = this.audioInput.currentNote();
      if (detected && this.isPlaying() && this.audioInput.isActive()) {
        const stringMap: Record<string, number> = { E: 3, A: 2, D: 1, G: 0 };
        const stringNum = stringMap[detected.string];
        this.checkHit(detected.note, stringNum);
      }
    });
  }

  async startExercise(sequence: Sequence, hitZonePosition: number): Promise<void> {
    if (this.isPlaying()) this.stop();

    await this.audio.resume();

    const bpm = this.tempo.bpm();
    const countdownDuration = (8 * 60) / bpm;
    const beatZeroTime = this.audio.context.currentTime + countdownDuration;

    this.tempo.start(beatZeroTime);
    this.isPlaying.set(true);
    this.lastNoteBeat = Math.max(...sequence.notes.map((n) => n.beat));

    //this.spawnNotesAndMarkers(sequence.notes, hitZonePosition, bpm);
    this.startAnimation();
  }

  stop(): void {
    this.isPlaying.set(false);
    this.tempo.stop();
    this.currentBeat.set(0);
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clear();
  }

  private checkHit(detectedNote: string, detectedString: number): void {
    const hitZone = this.hitZonePosition();

    this.notes.update((notes) =>
      notes.map((note) => {
        if (note.state !== 'approaching') return note;

        const distance = Math.abs(note.position - hitZone);
        const expectedNote = this.noteFromStringFret(note.string, note.fret);
        const correctNote = detectedNote === expectedNote && detectedString === note.string;

        if (note.duration) {
          return this.checkSustainedNote(note, distance, correctNote, hitZone);
        } else {
          return this.checkRegularNote(note, distance, correctNote);
        }
      })
    );
  }

  private checkSustainedNote(
    note: Note,
    distance: number,
    correctNote: boolean,
    hitZone: number
  ): Note {
    const sustainLength = note.duration! * this.pixelsPerBeat();
    const sustainEnd = hitZone + sustainLength;

    if (!note.sustainStarted && distance < this.entranceTolerance && correctNote) {
      this.flashHitZone();
      return { ...note, sustainStarted: true, sustainHitting: true };
    }

    if (note.sustainStarted) {
      if (!correctNote) {
        return { ...note, state: 'miss' as const, sustainHitting: false };
      }

      if (note.position >= sustainEnd - this.exitTolerance) {
        return { ...note, state: 'perfect' as const, sustainHitting: false };
      }

      return { ...note, sustainHitting: true };
    }

    return note;
  }

  private checkRegularNote(note: Note, distance: number, correctNote: boolean): Note {
    if (distance < this.entranceTolerance && correctNote) {
      this.flashHitZone();
      return { ...note, state: 'perfect' as const };
    }
    return note;
  }

  private spawnNotesAndMarkers(
    noteData: Sequence['notes'],
    hitZonePosition: number,
    bpm: number
  ): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const spawnPosition = 110;
    const travelDistance = spawnPosition - hitZonePosition;
    const leadInBeats = 8;
    this.pixelsPerBeat.set(travelDistance / leadInBeats);

    const notes = noteData.map(({ string, fret, beat, duration }) => ({
      id: `${Date.now()}-${string}-${fret}-${beat}`,
      string,
      fret,
      spawnBeat: beat,
      duration,
      sustainStarted: duration ? false : undefined,
      sustainHitting: duration ? false : undefined,
      position: spawnPosition + beat * this.pixelsPerBeat(),
      active: true,
      state: 'approaching' as const,
    }));

    const totalBeats = this.lastNoteBeat + 8;
    const markers = [];
    for (let beat = 0; beat < totalBeats; beat++) {
      const beatNumber = (beat % 4) + 1;
      markers.push({
        id: `marker-${beat}`,
        beatNumber,
        position: spawnPosition + beat * this.pixelsPerBeat(),
      });
    }

    this.notes.set(notes);
    this.beatMarkers.set(markers);
  }

  private startAnimation(): void {
    this.lastFrameTime = 0;
    this.animate();
  }

  private clear(): void {
    this.notes.set([]);
    this.beatMarkers.set([]);
    this.lastFrameTime = 0;
    this.lastNoteBeat = 0;
    this.pixelsPerBeat.set(0);
  }

  private animate(): void {
    if (!this.isPlaying()) return;

    const now = performance.now();
    const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0;
    this.lastFrameTime = now;

    const pixelsPerSecond = this.pixelsPerBeat() * (this.tempo.bpm() / 60);
    const pixelsToMove = pixelsPerSecond * deltaTime;

    this.notes.update((notes) =>
      notes
        .map((n) => {
          const newPos = n.position - pixelsToMove;

          if (n.state === 'approaching' && newPos < this.hitZonePosition() - 2) {
            if (n.duration && !n.sustainStarted) {
              return { ...n, position: newPos, state: 'miss' as const };
            } else if (!n.duration) {
              return { ...n, position: newPos, state: 'miss' as const };
            }
          }

          return { ...n, position: newPos };
        })
        .filter((n) => n.position > -10)
    );

    this.beatMarkers.update((markers) =>
      markers
        .map((m) => ({ ...m, position: m.position - pixelsToMove }))
        .filter((m) => m.position > -10)
    );

    this.currentBeat.set(this.tempo.getCurrentBeat());
    if (this.currentBeat() >= 0 && this.notes().length === 0 && this.pendingSequence) {
      this.spawnNotesAndMarkers(this.pendingSequence, this.hitZonePosition(), this.tempo.bpm());
      this.pendingSequence = null;
    }

    this.rafId = requestAnimationFrame(() => this.animate());
  }

  private noteFromStringFret(string: number, fret: number): string {
    const openNotes = [
      { note: 'G', octave: 2 },
      { note: 'D', octave: 2 },
      { note: 'A', octave: 1 },
      { note: 'E', octave: 1 },
    ];

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const open = openNotes[string];
    const openNoteIndex = noteNames.indexOf(open.note);

    const openSemitonesFromC = openNoteIndex + open.octave * 12;
    const targetSemitones = openSemitonesFromC + fret;

    const targetOctave = Math.floor(targetSemitones / 12);
    const targetNoteIndex = targetSemitones % 12;

    return `${noteNames[targetNoteIndex]}${targetOctave}`;
  }

  private flashHitZone(): void {
    this.hitZoneFlash.set(true);
    setTimeout(() => this.hitZoneFlash.set(false), 100);
  }
}
