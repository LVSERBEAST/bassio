import { Injectable, signal, effect, inject } from '@angular/core';
import { Audio } from './audio';
import { Tempo } from './tempo';

@Injectable({ providedIn: 'root' })
export class Metronome {
  private readonly audio = inject(Audio);
  private readonly tempo = inject(Tempo);
  readonly isActive = signal(false);

  private schedulerTimeout: number | null = null;
  private lastScheduledBeat = -999;

  constructor() {
    effect(() => {
      const isCounting = this.tempo.isCounting();
      const isActive = this.isActive();

      if (isActive && isCounting) {
        this.lastScheduledBeat = -999;
        this.scheduleClicks();
      } else {
        this.stopScheduling();
      }
    });
  }

  toggle(): void {
    this.isActive.update((active) => !active);
  }

  private scheduleClicks(): void {
    const scheduleAhead = 0.1;
    const beatDuration = 60 / this.tempo.bpm();
    const now = this.audio.context.currentTime;
    const startTime = this.tempo.getStartTime();
    const currentBeat = Math.floor(this.tempo.getCurrentBeat());

    for (let beat = currentBeat; beat < currentBeat + 4; beat++) {
      if (beat <= this.lastScheduledBeat) continue;

      const clickTime = startTime + beat * beatDuration;

      if (clickTime >= now && clickTime < now + scheduleAhead) {
        const isCountOff = beat < 0;
        const isCountOffClick = beat === -8 || beat === -6 || (beat >= -4 && beat < 0);
        const isDownbeat = beat >= 0 && beat % 4 === 0;
        const shouldClick = isCountOffClick || (!isCountOff && true); // After countdown, click all beats
        const isStrong = (isCountOff && isCountOffClick) || isDownbeat;

        if (shouldClick) {
          this.playClick(clickTime, isStrong);
          this.lastScheduledBeat = beat;
        }
      }
    }

    if (this.isActive() && this.tempo.isCounting()) {
      this.schedulerTimeout = window.setTimeout(() => this.scheduleClicks(), 25);
    }
  }

  private stopScheduling(): void {
    if (this.schedulerTimeout) {
      clearTimeout(this.schedulerTimeout);
      this.schedulerTimeout = null;
    }
    this.lastScheduledBeat = -999;
  }

  private playClick(time: number, isStrong: boolean): void {
    const osc = this.audio.context.createOscillator();
    const gain = this.audio.context.createGain();

    osc.connect(gain);
    gain.connect(this.audio.context.destination);

    osc.frequency.value = isStrong ? 1000 : 800;

    // Ramp from 0 to prevent pop
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(isStrong ? 0.3 : 0.15, time + 0.01);

    osc.start(time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    osc.stop(time + 0.05);
  }
}
