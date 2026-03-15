import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { BlockchainService, ActiveSession, SessionHistoryItem } from '../../services/blockchain';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-voting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voting.html',
  styleUrls: ['./voting.css']
})
export class VotingComponent implements OnInit, OnDestroy {
  walletAddress = '';
  hasToken = false;
  isLoading = false;
  statusMessage = '';
  isConnected = false;
  activeSessions: ActiveSession[] = [];
  sessionHistory: SessionHistoryItem[] = [];
  currentHistoryIndex = 0;
  selections: { [sessionId: number]: { [position: string]: string } } = {};

  private timerInterval: any;

  constructor(
    private blockchain: BlockchainService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  async connectWallet() {
    try {
      this.isLoading = true;
      this.statusMessage = 'Connecting wallet...';
      this.cdr.detectChanges();
      this.walletAddress = await this.blockchain.connectWallet();
      this.isConnected = true;
      this.hasToken = await this.blockchain.checkTokenBalance();
      this.activeSessions = await this.blockchain.getActiveSessions();
      this.sessionHistory = await this.blockchain.getSessionHistory();
      this.currentHistoryIndex = 0;
      this.initSelections();
      this.startTimer();
      this.statusMessage = '';
    } catch (err: any) {
      this.statusMessage = err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  initSelections() {
    for (const session of this.activeSessions) {
      if (!this.selections[session.id]) {
        this.selections[session.id] = {};
      }
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(async () => {
      let anyExpired = false;
      for (const session of this.activeSessions) {
        if (session.timeRemaining > 0) {
          session.timeRemaining--;
        } else if (session.active) {
          session.active = false;
          anyExpired = true;
        }
      }
      if (anyExpired) {
        this.sessionHistory = await this.blockchain.getSessionHistory();
        this.currentHistoryIndex = 0;
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  allPositionsSelected(session: ActiveSession): boolean {
    const sel = this.selections[session.id] || {};
    return session.positions.every(p => !!sel[p.name]);
  }

  async vote(session: ActiveSession) {
    const sel = this.selections[session.id] || {};
    const positions = session.positions.map(p => p.name);
    const candidates = positions.map(p => sel[p]);
    try {
      this.isLoading = true;
      this.statusMessage = `Voting in "${session.name}"... confirm in MetaMask`;
      this.cdr.detectChanges();
      await this.blockchain.approveAndVote(session.id, positions, candidates);
      session.hasVoted = true;
      this.activeSessions = await this.blockchain.getActiveSessions();
      this.initSelections();
      this.statusMessage = `Vote cast successfully in "${session.name}"!`;
    } catch (err: any) {
      this.statusMessage = err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  getBarWidth(count: number, counts: number[]): number {
    const max = Math.max(...counts, 1);
    return Math.round((count / max) * 100);
  }

  getWinner(candidates: string[], counts: number[]): string {
    if (!counts.length || Math.max(...counts) === 0) return 'No votes';
    return candidates[counts.indexOf(Math.max(...counts))];
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  prevHistory() {
    if (this.currentHistoryIndex < this.sessionHistory.length - 1)
      this.currentHistoryIndex++;
  }

  nextHistory() {
    if (this.currentHistoryIndex > 0)
      this.currentHistoryIndex--;
  }

  get currentSession(): SessionHistoryItem | null {
    return this.sessionHistory[this.currentHistoryIndex] ?? null;
  }
}
