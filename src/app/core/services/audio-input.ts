import { Injectable, signal } from '@angular/core';
import { interval, Subject, takeUntil, filter, map } from 'rxjs';
import { BassString } from './sequencer';

interface NoteDetection {
  note: string;
  frequency: number;
  cents: number;
  string: BassString;
}

@Injectable({ providedIn: 'root' })
export class AudioInput {
  readonly isConnected = signal(false);
  readonly isActive = signal(false);
  readonly currentNote = signal<NoteDetection | null>(null);
  readonly spectrum = signal<Uint8Array>(new Uint8Array(20));

  private readonly destroy$ = new Subject<void>();
  private readonly buffer = new Float32Array(8192);
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  private readonly MIN_FREQ = 38;
  private readonly MAX_FREQ = 400;

  constructor() {
    this.attemptConnection();
    this.setupDeviceChangeListener();
  }

  private async attemptConnection(): Promise<void> {
    try {
      await this.start();
      this.isConnected.set(true);
    } catch {
      this.isConnected.set(false);
    }
  }

  private setupDeviceChangeListener(): void {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        if (!this.isConnected()) {
          this.attemptConnection();
        }
      });
    }
  }

  async start(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        },
      });

      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 8192;
      this.analyser.smoothingTimeConstant = 0;

      const source = this.context.createMediaStreamSource(stream);
      source.connect(this.analyser);

      this.isConnected.set(true);

      interval(20)
        .pipe(
          takeUntil(this.destroy$),
          map(() => {
            const freq = this.detectPitch();
            this.updateSpectrum();
            return freq > 0 ? this.frequencyToNote(freq) : null;
          })
        )
        .subscribe((note) => this.currentNote.set(note));

      this.isActive.set(true);
    } catch (error) {
      this.isConnected.set(false);
      throw new Error('No audio input available');
    }
  }

  stop(): void {
    this.destroy$.next();
    this.context?.close();
    this.context = null;
    this.analyser = null;
    this.isActive.set(false);
  }

  private detectPitch(): number {
    if (!this.analyser || !this.context) return -1;
    this.analyser.getFloatTimeDomainData(this.buffer);

    const rms = Math.sqrt(
      this.buffer.reduce((sum, val) => sum + val * val, 0) / this.buffer.length
    );

    if (rms < 0.01) return -1;

    const minSamples = Math.floor(this.context.sampleRate / this.MAX_FREQ);
    const maxSamples = Math.floor(this.context.sampleRate / this.MIN_FREQ);
    const tau = this.yinPitch(minSamples, maxSamples);

    return tau > 0 ? this.context.sampleRate / tau : -1;
  }

  private yinPitch(minTau: number, maxTau: number): number {
    const size = this.buffer.length / 2;
    const threshold = 0.05;

    // Step 1: Difference function
    const diff = new Float32Array(maxTau);
    for (let tau = 0; tau < maxTau; tau++) {
      for (let i = 0; i < size; i++) {
        const delta = this.buffer[i] - this.buffer[i + tau];
        diff[tau] += delta * delta;
      }
    }

    // Step 2: Cumulative mean normalized difference
    const cmndf = new Float32Array(maxTau);
    cmndf[0] = 1;
    let runningSum = 0;

    for (let tau = 1; tau < maxTau; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = diff[tau] / (runningSum / tau);
    }

    // Step 3: Absolute threshold - find first minimum below threshold
    for (let tau = minTau; tau < maxTau; tau++) {
      if (cmndf[tau] < threshold) {
        // Parabolic interpolation for sub-sample accuracy
        let betterTau = tau;
        if (tau > 0 && tau < maxTau - 1) {
          const s0 = cmndf[tau - 1];
          const s1 = cmndf[tau];
          const s2 = cmndf[tau + 1];
          betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }
        return betterTau;
      }
    }

    return -1; // No pitch found
  }

  private updateSpectrum(): void {
    if (!this.analyser) return;

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    const nyquist = this.context!.sampleRate / 2;
    const binWidth = nyquist / frequencyData.length;
    const startBin = Math.floor(30 / binWidth);
    const endBin = Math.floor(400 / binWidth);
    const bassRange = frequencyData.slice(startBin, endBin);

    const barData = new Uint8Array(20);
    const binsPerBar = Math.floor(bassRange.length / 20);

    for (let i = 0; i < 20; i++) {
      let sum = 0;
      for (let j = 0; j < binsPerBar; j++) {
        sum += bassRange[i * binsPerBar + j];
      }
      barData[i] = sum / binsPerBar;
    }

    this.spectrum.set(barData);
  }

  private frequencyToNote(frequency: number): NoteDetection {
    const bassStrings = [
      { note: 'E', freq: 41.2, string: BassString.E },
      { note: 'A', freq: 55.0, string: BassString.A },
      { note: 'D', freq: 73.4, string: BassString.D },
      { note: 'G', freq: 98.0, string: BassString.G },
    ];

    const A4 = 440;
    const halfSteps = 12 * Math.log2(frequency / A4);
    const rounded = Math.round(halfSteps);
    const cents = Math.round((halfSteps - rounded) * 100);

    const noteIndex = ((rounded % 12) + 12) % 12;
    const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    const octave = Math.floor((rounded + 57) / 12);

    const closestString = bassStrings.reduce((prev, curr) =>
      Math.abs(curr.freq - frequency) < Math.abs(prev.freq - frequency) ? curr : prev
    );

    return {
      note: `${notes[noteIndex]}${octave}`,
      frequency,
      cents,
      string: closestString.string,
    };
  }
}
