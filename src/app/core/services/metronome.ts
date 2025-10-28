import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Metronome {
  readonly bpm = signal(120);
  readonly isActive = signal(false);
  readonly isPlaying = signal(false);
  readonly currentBeat = signal(0);
  readonly countOffMode = signal(false);
  private countOffBeats = 0;
  private intervalId: number | null = null;
  private audioContext = new AudioContext();

  startCountOff(): void {
    this.countOffMode.set(true);
    this.countOffBeats = 0;
    this.isPlaying.set(true);
    this.scheduleCountOff();
  }

  private scheduleCountOff(): void {
    const interval = (60 / this.bpm()) * 1000;

    const countOffSequence = () => {
      this.playClick();
      this.countOffBeats++;

      // 1-2-1-2-3-4 pattern
      if (this.countOffBeats < 6) {
        setTimeout(countOffSequence, interval);
      } else {
        this.countOffMode.set(false);
        this.scheduleBeats();
      }
    };

    countOffSequence();
  }

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
    const interval = (60 / this.bpm()) * 1000;
    this.playClick();

    this.intervalId = setInterval(() => {
      this.currentBeat.update((b) => (b + 1) % 4);
      this.playClick();
    }, interval) as unknown as number;
  }

  private playClick(): void {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    const isDownbeat = this.currentBeat() === 0;
    osc.frequency.value = isDownbeat ? 1000 : 800;
    gain.gain.value = isDownbeat ? 0.3 : 0.15;

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
    osc.stop(this.audioContext.currentTime + 0.05);
  }
}
