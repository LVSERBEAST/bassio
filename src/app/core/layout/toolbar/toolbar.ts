import { Component, signal, computed, inject, effect } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { AudioInput } from '../../services/audio-input';
import { Metronome } from '../../services/metronome';

@Component({
  selector: 'toolbar',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, RouterLink],
  templateUrl: './toolbar.html',
  styleUrls: ['./toolbar.scss'],
})
export class Toolbar {
  private readonly audioInput = inject(AudioInput);
  protected readonly metronome = inject(Metronome);
  protected readonly userName = signal('Marcus');
  protected readonly tunerActive = signal(false);
  protected readonly currentNote = signal('E');
  protected readonly centsDiff = signal(0);
  protected readonly needlePosition = signal(0);
  protected readonly metronomeActive = computed(() => this.metronome.isActive());

  protected readonly isAudioConnected = computed(() => this.audioInput.isConnected());
  protected readonly audioLevels = computed(() => {
    if (!this.audioInput.isActive()) return Array(20).fill(0);

    const spectrum = this.audioInput.spectrum();
    const hasNote = this.audioInput.currentNote() !== null;
    const boost = hasNote ? 2.0 : 1.2; // 2x when note, 1.2x baseline

    return Array.from(spectrum).map((val) => Math.min(100, (val / 255) * 100 * boost));
  });

  constructor() {
    effect(() => {
      const detected = this.audioInput.currentNote();
      if (detected) {
        this.currentNote.set(detected.note);
        this.centsDiff.set(detected.cents);
        this.needlePosition.set(Math.max(0, Math.min(100, 50 + detected.cents)));
      }
    });

    effect(() => {
      this.tunerActive.set(this.audioInput.isActive());
    });
  }

  protected async toggleTuner(): Promise<void> {
    if (this.tunerActive()) {
      this.audioInput.stop();
    } else {
      try {
        await this.audioInput.start();
      } catch (error) {
        alert('No audio input detected. Please connect a microphone or audio interface.');
      }
    }
  }

  protected toggleMetronome(): void {
    this.metronome.toggle();
  }

  protected adjustBpm(delta: number): void {
    this.metronome.setBpm(this.metronome.bpm() + delta);
  }

  protected onBpmInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
      this.metronome.setBpm(value);
    }
  }

  onUserClick() {
    console.log('User menu');
  }
}
