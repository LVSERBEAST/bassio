import { Component, signal, computed, inject, DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Sequencer, Sequence } from '../../../core/services/sequencer';

interface KeyInfo {
  id: number;
  name: string;
  major: string;
  minor: string;
  angle: number;
  sharps: number;
  flats: number;
}

type ExerciseType =
  | 'circle-nav'
  | 'scale-patterns'
  | 'root-finding'
  | 'interval-practice'
  | 'chord-tones'
  | 'walking-bass';

interface Exercise {
  id: ExerciseType;
  name: string;
  description: string;
}

@Component({
  selector: 'circle-of-fourths',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './circle-of-fourths.html',
  styleUrls: ['./circle-of-fourths.scss'],
})
export class CircleOfFourths {
  Math = Math;
  protected readonly sequencer = inject(Sequencer);
  private readonly destroyRef = inject(DestroyRef);

  selectedKey = signal<number>(0);
  currentExercise = signal<ExerciseType>('scale-patterns');
  octavePattern = signal<1 | 2>(1);
  intervalType = signal<'roots' | '3rds' | '5ths' | 'triads'>('roots');

  exercises = signal<Exercise[]>([
    {
      id: 'circle-nav',
      name: 'Circle Navigation',
      description: 'Navigate the circle by intervals',
    },
    {
      id: 'scale-patterns',
      name: 'Scale Patterns',
      description: 'Learn and play scale fingerings',
    },
    { id: 'root-finding', name: 'Root Finding', description: 'Find all roots in the current key' },
    {
      id: 'interval-practice',
      name: 'Interval Practice',
      description: 'Practice intervals and triads',
    },
    { id: 'chord-tones', name: 'Chord Tones', description: 'Play chord tones over changes' },
    { id: 'walking-bass', name: 'Walking Bass', description: 'Build walking bass lines' },
  ]);

  keys = signal<KeyInfo[]>([
    { id: 0, name: 'C', major: 'C Major', minor: 'Am', angle: 0, sharps: 0, flats: 0 },
    { id: 1, name: 'G', major: 'G Major', minor: 'Em', angle: 30, sharps: 1, flats: 0 },
    { id: 2, name: 'D', major: 'D Major', minor: 'Bm', angle: 60, sharps: 2, flats: 0 },
    { id: 3, name: 'A', major: 'A Major', minor: 'F#m', angle: 90, sharps: 3, flats: 0 },
    { id: 4, name: 'E', major: 'E Major', minor: 'C#m', angle: 120, sharps: 4, flats: 0 },
    { id: 5, name: 'B', major: 'B Major', minor: 'G#m', angle: 150, sharps: 5, flats: 0 },
    { id: 6, name: 'F#/Gb', major: 'F# Major', minor: 'D#m', angle: 180, sharps: 6, flats: 6 },
    { id: 7, name: 'Db', major: 'Db Major', minor: 'Bbm', angle: 210, sharps: 0, flats: 5 },
    { id: 8, name: 'Ab', major: 'Ab Major', minor: 'Fm', angle: 240, sharps: 0, flats: 4 },
    { id: 9, name: 'Eb', major: 'Eb Major', minor: 'Cm', angle: 270, sharps: 0, flats: 3 },
    { id: 10, name: 'Bb', major: 'Bb Major', minor: 'Gm', angle: 300, sharps: 0, flats: 2 },
    { id: 11, name: 'F', major: 'F Major', minor: 'Dm', angle: 330, sharps: 0, flats: 1 },
  ]);

  currentKey = computed(() => this.keys()[this.selectedKey()]);

  currentExerciseInfo = computed(() =>
    this.exercises().find((e) => e.id === this.currentExercise())
  );

  relatedKeys = computed(() => {
    const idx = this.selectedKey();
    const keys = this.keys();
    return {
      fourthUp: keys[(idx + 1) % 12],
      fourthDown: keys[(idx - 1 + 12) % 12],
      relativeMinor: this.currentKey().minor,
    };
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.sequencer.stop();
    });
  }

  selectKey(id: number) {
    this.selectedKey.set(id);
  }

  changeExercise(exerciseId: ExerciseType) {
    this.currentExercise.set(exerciseId);
  }

  async toggleExercise(): Promise<void> {
    if (this.sequencer.isPlaying()) {
      this.sequencer.stop();
    } else {
      const sequence = this.generateSequence();
      await this.sequencer.startExercise(sequence, 15);
    }
  }

  private generateSequence(): Sequence {
    const exercise = this.currentExercise();

    switch (exercise) {
      case 'scale-patterns':
        return this.generateScalePattern();
      case 'root-finding':
        return this.generateRootPattern();
      case 'interval-practice':
        return this.generateIntervalPattern();
      default:
        return { notes: [] };
    }
  }

  private generateScalePattern(): Sequence {
    return {
      notes: [
        { string: 3, fret: 8, beat: 0 },
        { string: 3, fret: 10, beat: 1 },
        { string: 3, fret: 12, beat: 2 },
        { string: 3, fret: 13, beat: 3 },
        { string: 3, fret: 15, beat: 4 },
        { string: 2, fret: 2, beat: 5 },
        { string: 2, fret: 4, beat: 6 },
        { string: 2, fret: 5, beat: 7 },
      ],
    };
  }

  private generateRootPattern(): Sequence {
    return {
      notes: [
        { string: 3, fret: 8, beat: 0 },
        { string: 2, fret: 3, beat: 2 },
        { string: 1, fret: 10, beat: 4 },
        { string: 0, fret: 5, beat: 6 },
      ],
    };
  }

  private generateIntervalPattern(): Sequence {
    return {
      notes: [
        { string: 3, fret: 8, beat: 0 },
        { string: 3, fret: 10, beat: 1 },
        { string: 2, fret: 3, beat: 2 },
        { string: 2, fret: 5, beat: 3 },
      ],
    };
  }
}