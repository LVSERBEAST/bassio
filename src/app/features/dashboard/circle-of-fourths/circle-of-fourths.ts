import { Component, signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface KeyInfo {
  id: number;
  name: string;
  major: string;
  minor: string;
  angle: number;
  sharps: number;
  flats: number;
  status: 'locked' | 'active' | 'completed';
}

type PracticeMode = 'identification' | 'scale-builder' | 'chord-navigator';

@Component({
  selector: 'circle-of-fourths',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTabsModule, MatProgressBarModule],
  templateUrl: './circle-of-fourths.html',
  styleUrls: ['./circle-of-fourths.scss'],
})
export class CircleOfFourths {
  Math = Math; // Expose Math to template
  
  currentMode = signal<PracticeMode>('identification');
  selectedKey = signal<number>(0);
  streak = signal(0);
  timer = signal(0);

  private modes: PracticeMode[] = ['identification', 'scale-builder', 'chord-navigator'];

  keys = signal<KeyInfo[]>([
    { id: 0, name: 'C', major: 'C Major', minor: 'A minor', angle: 0, sharps: 0, flats: 0, status: 'active' },
    { id: 1, name: 'G', major: 'G Major', minor: 'E minor', angle: 30, sharps: 1, flats: 0, status: 'active' },
    { id: 2, name: 'D', major: 'D Major', minor: 'B minor', angle: 60, sharps: 2, flats: 0, status: 'active' },
    { id: 3, name: 'A', major: 'A Major', minor: 'F# minor', angle: 90, sharps: 3, flats: 0, status: 'locked' },
    { id: 4, name: 'E', major: 'E Major', minor: 'C# minor', angle: 120, sharps: 4, flats: 0, status: 'locked' },
    { id: 5, name: 'B', major: 'B Major', minor: 'G# minor', angle: 150, sharps: 5, flats: 0, status: 'locked' },
    { id: 6, name: 'F#/Gb', major: 'F# Major', minor: 'D# minor', angle: 180, sharps: 6, flats: 6, status: 'locked' },
    { id: 7, name: 'Db', major: 'Db Major', minor: 'Bb minor', angle: 210, sharps: 0, flats: 5, status: 'locked' },
    { id: 8, name: 'Ab', major: 'Ab Major', minor: 'F minor', angle: 240, sharps: 0, flats: 4, status: 'locked' },
    { id: 9, name: 'Eb', major: 'Eb Major', minor: 'C minor', angle: 270, sharps: 0, flats: 3, status: 'locked' },
    { id: 10, name: 'Bb', major: 'Bb Major', minor: 'G minor', angle: 300, sharps: 0, flats: 2, status: 'locked' },
    { id: 11, name: 'F', major: 'F Major', minor: 'D minor', angle: 330, sharps: 0, flats: 1, status: 'locked' },
  ]);

  currentKey = computed(() => this.keys()[this.selectedKey()]);
  
  relatedKeys = computed(() => {
    const idx = this.selectedKey();
    const keys = this.keys();
    return {
      fourthUp: keys[(idx + 1) % 12],
      fourthDown: keys[(idx - 1 + 12) % 12],
      relativeMajor: this.currentKey().major,
      relativeMinor: this.currentKey().minor,
    };
  });

  completedCount = computed(() => 
    this.keys().filter(k => k.status === 'completed').length
  );

  progress = computed(() => 
    Math.round((this.completedCount() / 12) * 100)
  );

  selectKey(id: number) {
    const key = this.keys()[id];
    if (key.status !== 'locked') {
      this.selectedKey.set(id);
    }
  }

  onModeChange(index: number) {
    this.currentMode.set(this.modes[index]);
  }

  checkAnswer() {
    console.log('Check answer for mode:', this.currentMode());
  }

  playKey() {
    console.log('Playing:', this.currentKey().name);
  }

  nextKey() {
    const current = this.selectedKey();
    const next = (current + 1) % 12;
    this.selectKey(next);
  }

  skipKey() {
    this.nextKey();
  }
}