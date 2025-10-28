import { Injectable, signal } from '@angular/core';
import { interval, Subject, takeUntil, filter, map } from 'rxjs';

interface NoteDetection {
  note: string;
  frequency: number;
  cents: number;
  string: 'E' | 'A' | 'D' | 'G';
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

  // 4-string bass: E1=41.2Hz, A1=55Hz, D2=73.4Hz, G2=98Hz
  // 5-string adds: B0=30.87Hz
  private readonly MIN_FREQ = 38;
  private readonly MAX_FREQ = 400; // Covers harmonics

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
    this.isConnected.set(false);
  }

  private detectPitch(): number {
    if (!this.analyser || !this.context) return -1;
    this.analyser.getFloatTimeDomainData(this.buffer);

    const rms = Math.sqrt(
      this.buffer.reduce((sum, val) => sum + val * val, 0) / this.buffer.length
    );

    if (rms < 0.00001) return -1; // Lower threshold for bass

    const minSamples = Math.floor(this.context.sampleRate / this.MAX_FREQ);
    const maxSamples = Math.floor(this.context.sampleRate / this.MIN_FREQ);
    const { offset, correlation } = this.findPeakOffset(minSamples, maxSamples);

    return correlation > 0.7 ? this.context.sampleRate / offset : -1;
  }

  private updateSpectrum(): void {
    if (!this.analyser) return;

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    // Focus on bass range (30-400Hz)
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

  private findPeakOffset(
    minOffset: number,
    maxOffset: number
  ): { offset: number; correlation: number } {
    let bestOffset = -1;
    let bestCorrelation = 0;
    const size = this.buffer.length / 2;

    let energy = 0;
    for (let i = 0; i < size; i++) {
      energy += this.buffer[i] * this.buffer[i];
    }

    if (energy === 0) return { offset: -1, correlation: 0 };

    // Parabolic interpolation for sub-sample precision
    for (let offset = minOffset; offset < Math.min(maxOffset, size); offset++) {
      let sum = 0;
      for (let i = 0; i < size; i++) {
        sum += this.buffer[i] * this.buffer[i + offset];
      }

      const correlation = sum / energy;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    return { offset: bestOffset, correlation: bestCorrelation };
  }

  private frequencyToNote(frequency: number): NoteDetection {
    const bassStrings = [
      { note: 'E', freq: 41.2, string: 'E' as const },
      { note: 'A', freq: 55.0, string: 'A' as const },
      { note: 'D', freq: 73.4, string: 'D' as const },
      { note: 'G', freq: 98.0, string: 'G' as const },
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
