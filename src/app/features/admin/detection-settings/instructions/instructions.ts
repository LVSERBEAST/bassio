import { Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'instructions',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './instructions.html',
  styleUrls: ['./instructions.scss'],
})
export class Instructions {
  close = output<void>();
}