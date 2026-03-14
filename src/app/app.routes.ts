import { Routes } from '@angular/router';
import { VotingComponent } from './components/voting/voting';
import { AdminComponent } from './components/admin/admin';

export const routes: Routes = [
  { path: '', component: VotingComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: '' }
];
