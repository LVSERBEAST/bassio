import { Routes } from '@angular/router';
import { Layout } from './core/layout/layout';
import { Dashboard } from './features/dashboard/dashboard';
import { CircleOfFourths } from './features/dashboard/circle-of-fourths/circle-of-fourths';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', component: Dashboard },
      { path: 'circle-of-fourths', component: CircleOfFourths },
    ],
  },
  { path: '**', redirectTo: '' },
];
