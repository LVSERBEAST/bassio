import { Component, signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface Lesson {
  id: number;
  title: string;
  description: string;
  duration: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  status: 'completed' | 'current' | 'locked';
  skills: string[];
  progress?: number;
}

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class Dashboard {
  currentIndex = signal(2);
  
  lessons = signal<Lesson[]>([
    {
      id: 1,
      title: 'Bass Fundamentals',
      description: 'Learn proper posture, hand positioning, and basic bass guitar technique fundamentals.',
      duration: 15,
      difficulty: 'Beginner',
      status: 'completed',
      skills: ['Posture', 'Hand Position', 'Basic Technique'],
    },
    {
      id: 2,
      title: 'Standard Tuning',
      description: 'Master the standard bass tuning (E-A-D-G) and learn to tune your instrument accurately.',
      duration: 12,
      difficulty: 'Beginner',
      status: 'completed',
      skills: ['Tuning', 'Pitch Recognition', 'String Names'],
    },
    {
      id: 3,
      title: 'Fretboard Navigation',
      description: 'Master note positions across all strings and frets. Learn the musical alphabet on the bass fretboard.',
      duration: 20,
      difficulty: 'Intermediate',
      status: 'current',
      skills: ['Note Names', 'Octave Patterns', 'Position Markers'],
      progress: 35,
    },
    {
      id: 4,
      title: 'Major Scale Patterns',
      description: 'Learn the major scale fingering patterns and how to play them across the fretboard.',
      duration: 18,
      difficulty: 'Intermediate',
      status: 'locked',
      skills: ['Scale Patterns', 'Fingering', 'Major Scale'],
    },
    {
      id: 5,
      title: 'Circle of Fourths',
      description: 'Understand key relationships and harmonic theory through the circle of fourths.',
      duration: 25,
      difficulty: 'Advanced',
      status: 'locked',
      skills: ['Key Relationships', 'Harmony', 'Music Theory'],
    },
    {
      id: 6,
      title: 'Chord Construction',
      description: 'Learn how to build major, minor, and extended chords from scale degrees.',
      duration: 22,
      difficulty: 'Advanced',
      status: 'locked',
      skills: ['Chord Building', 'Intervals', 'Harmony'],
    },
    {
      id: 7,
      title: 'Advanced Techniques',
      description: 'Master slapping, popping, and other advanced bass techniques.',
      duration: 30,
      difficulty: 'Expert',
      status: 'locked',
      skills: ['Slapping', 'Popping', 'Advanced Techniques'],
    },
  ]);

  currentLesson = computed(() => this.lessons()[this.currentIndex()]);
  
  completedCount = computed(() => 
    this.lessons().filter(l => l.status === 'completed').length
  );
  
  totalCount = computed(() => this.lessons().length);
  
  overallProgress = computed(() =>
    Math.round((this.completedCount() / this.totalCount()) * 100)
  );

  canGoNext = computed(() => this.currentIndex() < this.lessons().length - 1);
  canGoPrev = computed(() => this.currentIndex() > 0);

  navigate(direction: 'prev' | 'next') {
    if (direction === 'prev' && this.canGoPrev()) {
      this.currentIndex.update(i => i - 1);
    } else if (direction === 'next' && this.canGoNext()) {
      this.currentIndex.update(i => i + 1);
    }
  }

  selectLesson(index: number) {
    const lesson = this.lessons()[index];
    if (lesson.status !== 'locked') {
      this.currentIndex.set(index);
    }
  }

  startLesson() {
    console.log('Starting:', this.currentLesson().id);
  }

  skipLesson() {
    const idx = this.currentIndex();
    const lessons = this.lessons();
    
    if (idx < lessons.length - 1) {
      const updated = lessons.map((l, i) => {
        if (i === idx) return { ...l, status: 'completed' as const };
        if (i === idx + 1 && l.status === 'locked') return { ...l, status: 'current' as const };
        return l;
      });

      this.lessons.set(updated);
      this.navigate('next');
    }
  }
}