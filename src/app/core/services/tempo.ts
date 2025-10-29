import { Injectable, signal, inject } from '@angular/core';
import { Audio } from './audio';

@Injectable({ providedIn: 'root' })
export class Tempo {
  private readonly audio = inject(Audio);
  readonly bpm = signal(100);
  readonly isCounting = signal(false);
  private startTime = 0;

  setBpm(value: number): void {
    this.bpm.set(Math.max(40, Math.min(240, value)));
  }

  start(beatZeroTime: number): void {
  this.startTime = beatZeroTime;
  this.isCounting.set(true);
}

stop(): void {
  this.startTime = 0;
  this.isCounting.set(false);
}

  getCurrentBeat(): number {
    if (this.startTime === 0) return 0;
    const elapsed = this.audio.context.currentTime - this.startTime;
    return elapsed * (this.bpm() / 60);
  }

  getStartTime(): number {
    return this.startTime;
  }
}
