import {
  Component,
  signal,
  computed,
  inject,
  effect,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { AudioInput } from '../../../core/services/audio-input';

interface HistoryItem {
  note: string | null;
  frequency: number;
  string: number | undefined;
  timestamp: string;
}

@Component({
  selector: 'detection-settings',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, FormsModule, MatSlideToggleModule],
  templateUrl: './detection-settings.html',
  styleUrls: ['./detection-settings.scss'],
})
export class DetectionSettings implements AfterViewInit {
  @ViewChild('waveformCanvas') waveformCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('spectrumCanvas') spectrumCanvas?: ElementRef<HTMLCanvasElement>;

  protected readonly audioInput = inject(AudioInput);
  private readonly router = inject(Router);

  protected readonly isPaused = signal(false);
  protected readonly history = signal<HistoryItem[]>([]);
  protected readonly waveformEnabled = signal(true);
  protected readonly spectrumEnabled = signal(true);

  protected readonly currentDetection = computed(() => this.audioInput.currentNote());

  protected readonly attackStatus = computed(() => ({
    active: this.audioInput.attackFrames() > 0,
    remaining: this.audioInput.attackFrames(),
  }));

  protected readonly medianBuffer = computed(() => this.audioInput.noteHistory());

  protected rmsThreshold = this.audioInput.params.rmsThreshold;
  protected yinThreshold = this.audioInput.params.yinThreshold;
  protected attackMultiplier = this.audioInput.params.attackMultiplier;
  protected attackMinRms = this.audioInput.params.attackMinRms;
  protected attackSkipFrames = this.audioInput.params.attackSkipFrames;
  protected medianSize = this.audioInput.params.medianSize;
  protected updateInterval = this.audioInput.params.updateInterval;
  protected minFrequency = this.audioInput.params.minFrequency;
  protected maxFrequency = this.audioInput.params.maxFrequency;
  protected fftSize = this.audioInput.params.fftSize;

  constructor() {
    effect(() => {
      if (this.isPaused()) return;

      const detection = this.currentDetection();
      if (detection) {
        const timestamp = new Date().toLocaleTimeString();
        this.history.update((h) => [
          {
            note: detection.note,
            frequency: detection.frequency,
            string: detection.string,
            timestamp,
          },
          ...h.slice(0, 19),
        ]);
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.waveformEnabled()) this.startWaveformRender();
    if (this.spectrumEnabled()) this.startSpectrumRender();
  }

  protected goBack(): void {
    this.router.navigate(['/']);
  }

  protected togglePause(): void {
    this.isPaused.update((p) => !p);
  }

  protected exportLog(): void {
    const data = JSON.stringify(this.history(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detection-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected exportParams(): void {
    const params = {
      rmsThreshold: this.rmsThreshold(),
      yinThreshold: this.yinThreshold(),
      attackMultiplier: this.attackMultiplier(),
      attackMinRms: this.attackMinRms(),
      attackSkipFrames: this.attackSkipFrames(),
      medianSize: this.medianSize(),
      updateInterval: this.updateInterval(),
      minFrequency: this.minFrequency(),
      maxFrequency: this.maxFrequency(),
      fftSize: this.fftSize(),
    };

    const json = JSON.stringify(params, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detection-params.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected clearHistory(): void {
    this.history.set([]);
  }

  protected resetDefaults(): void {
    this.audioInput.loadDefaults();
  }

  protected setFftSize(size: 2048 | 4096 | 8192): void {
    this.audioInput.params.fftSize.set(size);
  }

  protected toggleWaveformRender(): void {
    this.waveformEnabled.update((v) => !v);
  }

  protected toggleSpectrumRender(): void {
    this.spectrumEnabled.update((v) => !v);
  }

  protected getStringColor(stringNum: number | undefined): string {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#eab308'];
    return stringNum !== undefined ? colors[stringNum] : '#57534e';
  }

  private startWaveformRender(): void {
    if (!this.waveformCanvas) return;
    const canvas = this.waveformCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (!this.waveformEnabled() || !this.audioInput.analyser) {
        requestAnimationFrame(render);
        return;
      }

      const buffer = new Float32Array(this.audioInput.analyser.fftSize);
      this.audioInput.analyser.getFloatTimeDomainData(buffer);

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      ctx.fillStyle = 'rgba(13, 12, 11, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#ee9800';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = canvas.width / buffer.length;
      let x = 0;

      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i];
        const y = ((v + 1) / 2) * canvas.height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();
      requestAnimationFrame(render);
    };

    render();
  }

  private startSpectrumRender(): void {
    if (!this.spectrumCanvas) return;
    const canvas = this.spectrumCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (!this.spectrumEnabled() || !this.audioInput.analyser) {
        requestAnimationFrame(render);
        return;
      }

      const bufferLength = this.audioInput.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.audioInput.analyser.getByteFrequencyData(dataArray);

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      ctx.fillStyle = 'rgba(13, 12, 11, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Focus on bass range: 40-200Hz
      const nyquist = this.audioInput.context!.sampleRate / 2;
      const binWidth = nyquist / bufferLength;
      const startBin = Math.floor(40 / binWidth);
      const endBin = Math.floor(200 / binWidth);
      const bassRange = dataArray.slice(startBin, endBin);

      const barWidth = canvas.width / bassRange.length;
      let x = 0;

      for (let i = 0; i < bassRange.length; i++) {
        const barHeight = (bassRange[i] / 255) * canvas.height;

        const hue = (i / bassRange.length) * 60 + 30;
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth;
      }

      requestAnimationFrame(render);
    };

    render();
  }
}
