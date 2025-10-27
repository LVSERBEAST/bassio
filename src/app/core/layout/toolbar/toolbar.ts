import { Component, signal, computed } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'toolbar',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './toolbar.html',
  styleUrls: ['./toolbar.scss']
})
export class Toolbar {
  audioLevels = signal(Array.from({ length: 20 }, () => Math.random() * 100));
  userName = signal('Marcus');
  isAudioConnected = signal(true);
  
  tunerActive = signal(false);
  currentNote = signal('E');
  centsDiff = signal(12);

  needlePosition = computed(() => {
    const cents = this.centsDiff();
    return Math.max(0, Math.min(100, 50 + cents));
  });

  constructor() {
    setInterval(() => {
      this.audioLevels.set(Array.from({ length: 20 }, () => Math.random() * 100));
    }, 50);
    
    setInterval(() => {
      if (this.tunerActive()) {
        this.centsDiff.set((Math.random() - 0.5) * 100);
        if (Math.random() < 0.08) {
          const notes = ['E', 'A', 'D', 'G', 'B', 'e'];
          this.currentNote.set(notes[Math.floor(Math.random() * notes.length)]);
        }
      }
    }, 250);
  }

  toggleTuner() {
    this.tunerActive.update(active => !active);
  }

  onPractice(option: string) {
    console.log(`Practice: ${option}`);
  }

  onSkillCheck() {
    console.log('Skill check');
  }

  onUserClick() {
    console.log('User menu');
  }
}