import { Component } from '@angular/core';
import { Toolbar } from './toolbar/toolbar';
import { RouterOutlet } from '@angular/router';
import { Fretboard } from './fret-board/fretboard';

@Component({
  selector: 'layout',
  standalone: true,
  imports: [Toolbar, RouterOutlet, Fretboard],
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss'],
})
export class Layout {}
