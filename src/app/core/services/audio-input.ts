import { Injectable, signal, effect } from '@angular/core';
import { interval, Subject, takeUntil, map, filter } from 'rxjs';
import { BassString } from './sequencer';

interface NoteDetection {
  note: string;
  frequency: number;
  cents: number;
  string: BassString;
}

export interface DetectionParams {
  rmsThreshold: number;
  yinThreshold: number;
  attackMultiplier: number;
  attackMinRms: number;
  attackSkipFrames: number;
  medianSize: number;
  updateInterval: number;
  minFrequency: number;
  maxFrequency: number;
  fftSize: 2048 | 4096 | 8192;
}

const DEFAULT_PARAMS: DetectionParams = {
  rmsThreshold: 0.01,
  yinThreshold: 0.15,
  attackMultiplier: 1.5,
  attackMinRms: 0.02,
  attackSkipFrames: 3,
  medianSize: 5,
  updateInterval: 50,
  minFrequency: 38,
  maxFrequency: 400,
  fftSize: 8192,
};

@Injectable({ providedIn: 'root' })
export class AudioInput {
  readonly isConnected = signal(false);
  readonly isActive = signal(false);
  readonly currentNote = signal<NoteDetection | null>(null);
  readonly spectrum = signal<Uint8Array>(new Uint8Array(20));

  // Public params as signals for live debugging
  readonly params = {
    rmsThreshold: signal(DEFAULT_PARAMS.rmsThreshold),
    yinThreshold: signal(DEFAULT_PARAMS.yinThreshold),
    attackMultiplier: signal(DEFAULT_PARAMS.attackMultiplier),
    attackMinRms: signal(DEFAULT_PARAMS.attackMinRms),
    attackSkipFrames: signal(DEFAULT_PARAMS.attackSkipFrames),
    medianSize: signal(DEFAULT_PARAMS.medianSize),
    updateInterval: signal(DEFAULT_PARAMS.updateInterval),
    minFrequency: signal(DEFAULT_PARAMS.minFrequency),
    maxFrequency: signal(DEFAULT_PARAMS.maxFrequency),
    fftSize: signal<2048 | 4096 | 8192>(DEFAULT_PARAMS.fftSize),
  };

  // Expose internal state for debugging
  readonly attackFrames = signal(0);
  readonly noteHistory = signal<(number | null)[]>([null, null, null, null, null]);

  private readonly destroy$ = new Subject<void>();
  private readonly buffer = new Float32Array(8192);
  context: AudioContext | null = null;
  analyser: AnalyserNode | null = null; // Public for canvas rendering
  private noteHistoryBuffer: (number | null)[] = [null, null, null, null, null];

  private lastAmplitude = 0;
  private attackFramesCount = 0;
  private intervalSub: any = null;

  constructor() {
    this.loadParams();
    this.attemptConnection();
    this.setupDeviceChangeListener();

    // Watch for FFT size changes
    effect(() => {
      const fftSize = this.params.fftSize();
      if (this.analyser) {
        this.analyser.fftSize = fftSize;
      }
    });

    // Watch for median size changes
    effect(() => {
      const size = this.params.medianSize();
      this.noteHistoryBuffer = Array(size).fill(null);
      this.noteHistory.set([...this.noteHistoryBuffer]);
    });
  }

  loadParams(): void {
    const stored = localStorage.getItem('bassio-detection-params');
    if (stored) {
      try {
        const params: DetectionParams = JSON.parse(stored);
        this.params.rmsThreshold.set(params.rmsThreshold);
        this.params.yinThreshold.set(params.yinThreshold);
        this.params.attackMultiplier.set(params.attackMultiplier);
        this.params.attackMinRms.set(params.attackMinRms);
        this.params.attackSkipFrames.set(params.attackSkipFrames);
        this.params.medianSize.set(params.medianSize);
        this.params.updateInterval.set(params.updateInterval);
        this.params.minFrequency.set(params.minFrequency);
        this.params.maxFrequency.set(params.maxFrequency);
        this.params.fftSize.set(params.fftSize);
      } catch (e) {
        console.error('Failed to load detection params:', e);
      }
    }
  }

  loadDefaults(): void {
    this.params.rmsThreshold.set(DEFAULT_PARAMS.rmsThreshold);
    this.params.yinThreshold.set(DEFAULT_PARAMS.yinThreshold);
    this.params.attackMultiplier.set(DEFAULT_PARAMS.attackMultiplier);
    this.params.attackMinRms.set(DEFAULT_PARAMS.attackMinRms);
    this.params.attackSkipFrames.set(DEFAULT_PARAMS.attackSkipFrames);
    this.params.medianSize.set(DEFAULT_PARAMS.medianSize);
    this.params.updateInterval.set(DEFAULT_PARAMS.updateInterval);
    this.params.minFrequency.set(DEFAULT_PARAMS.minFrequency);
    this.params.maxFrequency.set(DEFAULT_PARAMS.maxFrequency);
    this.params.fftSize.set(DEFAULT_PARAMS.fftSize);
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
      this.analyser.fftSize = this.params.fftSize();
      this.analyser.smoothingTimeConstant = 0;

      const source = this.context.createMediaStreamSource(stream);
      source.connect(this.analyser);

      this.isConnected.set(true);

      // Stop existing interval if restarting
      if (this.intervalSub) {
        this.intervalSub.unsubscribe();
      }

      this.intervalSub = interval(this.params.updateInterval())
        .pipe(
          takeUntil(this.destroy$),
          map(() => {
            const rms = Math.sqrt(
              this.buffer.reduce((sum, val) => sum + val * val, 0) / this.buffer.length
            );

            // Detect attack (amplitude spike)
            const isAttack =
              rms > this.lastAmplitude * this.params.attackMultiplier() &&
              rms > this.params.attackMinRms();
            this.lastAmplitude = rms;

            if (isAttack) {
              this.attackFramesCount = this.params.attackSkipFrames();
              this.noteHistoryBuffer = Array(this.params.medianSize()).fill(null);
              this.noteHistory.set([...this.noteHistoryBuffer]);
              this.attackFrames.set(this.attackFramesCount);
              return null;
            }

            // Skip pitch detection during attack
            if (this.attackFramesCount > 0) {
              this.attackFramesCount--;
              this.attackFrames.set(this.attackFramesCount);
              return null;
            }

            const freq = this.detectPitch();
            this.updateSpectrum();

            if (freq > 0) {
              this.noteHistoryBuffer.shift();
              this.noteHistoryBuffer.push(freq);
              this.noteHistory.set([...this.noteHistoryBuffer]);

              const sorted = this.noteHistoryBuffer
                .filter((f) => f !== null)
                .sort((a, b) => a! - b!);
              const medianFreq = sorted[Math.floor(sorted.length / 2)];

              if (medianFreq) {
                return this.frequencyToNote(medianFreq);
              }
            } else {
              this.noteHistoryBuffer = Array(this.params.medianSize()).fill(null);
              this.noteHistory.set([...this.noteHistoryBuffer]);
            }

            return null;
          }),
          filter((note) => note !== null)
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
    if (this.intervalSub) {
      this.intervalSub.unsubscribe();
    }
  }

  private detectPitch(): number {
    if (!this.analyser || !this.context) return -1;
    this.analyser.getFloatTimeDomainData(this.buffer);

    const rms = Math.sqrt(
      this.buffer.reduce((sum, val) => sum + val * val, 0) / this.buffer.length
    );

    if (rms < this.params.rmsThreshold()) return -1;

    const minSamples = Math.floor(this.context.sampleRate / this.params.maxFrequency());
    const maxSamples = Math.floor(this.context.sampleRate / this.params.minFrequency());
    const tau = this.yinPitch(minSamples, maxSamples);

    return tau > 0 ? this.context.sampleRate / tau : -1;
  }

  private yinPitch(minTau: number, maxTau: number): number {
    const size = this.buffer.length / 2;
    const threshold = this.params.yinThreshold();

    const diff = new Float32Array(maxTau);
    for (let tau = 0; tau < maxTau; tau++) {
      for (let i = 0; i < size; i++) {
        const delta = this.buffer[i] - this.buffer[i + tau];
        diff[tau] += delta * delta;
      }
    }

    const cmndf = new Float32Array(maxTau);
    cmndf[0] = 1;
    let runningSum = 0;

    for (let tau = 1; tau < maxTau; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = diff[tau] / (runningSum / tau);
    }

    for (let tau = minTau; tau < maxTau; tau++) {
      if (cmndf[tau] < threshold) {
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

    return -1;
  }

  private updateSpectrum(): void {
    if (!this.analyser) return;

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    const nyquist = this.context!.sampleRate / 2;
    const binWidth = nyquist / frequencyData.length;
    const startBin = Math.floor(40 / binWidth);
    const endBin = Math.floor(200 / binWidth);
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