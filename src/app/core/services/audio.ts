import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Audio {
  readonly context = new AudioContext();

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
}
