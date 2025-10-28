import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Metronome {
  readonly bpm = signal(120);
  readonly isActive = signal(false);
  readonly isPlaying = signal(false);
  readonly currentBeat = signal(0);
  private intervalId: number | null = null;
  private audioContext = new AudioContext();

  toggle(): void {
    this.isActive.update((active) => !active);
    if (!this.isActive()) {
      this.stop();
    }
  }

  start(): void {
    if (this.isPlaying() || !this.isActive()) return;
    this.isPlaying.set(true);
    this.currentBeat.set(0);
    this.scheduleBeats();
  }

  stop(): void {
    this.isPlaying.set(false);
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentBeat.set(0);
  }

  setBpm(bpm: number): void {
    const wasPlaying = this.isPlaying();
    if (wasPlaying) this.stop();
    this.bpm.set(Math.max(40, Math.min(240, bpm)));
    if (wasPlaying) this.start();
  }

  private scheduleBeats(): void {
    // Schedule clicks ahead using audio time, not setInterval
    const scheduleAhead = 0.1; // 100ms lookahead
    let nextBeatTime = this.audioContext.currentTime;

    const scheduler = () => {
      while (nextBeatTime < this.audioContext.currentTime + scheduleAhead) {
        this.playClick(nextBeatTime);
        nextBeatTime += 60 / this.bpm();
        this.currentBeat.update((b) => (b + 1) % 4);
      }
      if (this.isPlaying()) {
        setTimeout(scheduler, 25);
      }
    };
    scheduler();
  }

  private playClick(time: number): void {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    const isDownbeat = this.currentBeat() === 0;
    osc.frequency.value = isDownbeat ? 1000 : 800;
    gain.gain.value = isDownbeat ? 0.3 : 0.15;

    osc.start(time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    osc.stop(time + 0.05);
  }
}
