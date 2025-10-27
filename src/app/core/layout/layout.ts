import { Component } from '@angular/core';
import { Toolbar } from './toolbar/toolbar';
import { RouterOutlet } from '@angular/router';
import { NoteHighway } from './fret-board/note-highway';

@Component({
  selector: 'layout',
  standalone: true,
  imports: [Toolbar, RouterOutlet, NoteHighway],
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss'],
})
export class Layout {}
