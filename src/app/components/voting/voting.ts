import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { BlockchainService, SessionResult } from '../../services/blockchain';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-voting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voting.html',
  styleUrls: ['./voting.css']
})
export class VotingComponent implements OnInit, OnDestroy {
  walletAddress = '';
  candidates: string[] = [];
  voteCounts: { name: string; count: number }[] = [];
  hasVoted = false;
  hasToken = false;
  isLoading = false;
  statusMessage = '';
  isConnected = false;
  sessionActive = false;
  timeRemaining = 0;
  sessionHistory: SessionResult[] = [];
  currentHistoryIndex = 0;

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
      this.hasVoted = await this.blockchain.hasVoted();
      this.sessionActive = await this.blockchain.getSessionActive();
      this.candidates = await this.blockchain.getCandidates();
      this.voteCounts = await this.blockchain.getVoteCounts();
      this.sessionHistory = await this.blockchain.getSessionHistory();
      if (this.sessionActive) {
        this.timeRemaining = await this.blockchain.getTimeRemaining();
        this.startTimer();
      }
      this.statusMessage = '';
    } catch (err: any) {
      this.statusMessage = err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  startTimer() {
  if (this.timerInterval) clearInterval(this.timerInterval);
  this.timerInterval = setInterval(async () => {
    if (this.timeRemaining > 0) {
      this.timeRemaining--;
      this.cdr.detectChanges();
    } else {
      clearInterval(this.timerInterval);
      this.sessionActive = false;
      this.statusMessage = 'Voting session has ended. See results below.';
      this.voteCounts = await this.blockchain.getVoteCounts();
      this.sessionHistory = await this.blockchain.getSessionHistory();
      this.currentHistoryIndex = 0;
      this.cdr.detectChanges();
    }
  }, 1000);
}

  async vote(candidate: string) {
    try {
      this.isLoading = true;
      this.statusMessage = 'Approving token... please confirm in MetaMask';
      this.cdr.detectChanges();
      await this.blockchain.approveAndVote(candidate);
      this.statusMessage = 'Vote cast successfully!';
      this.hasVoted = true;
      this.voteCounts = await this.blockchain.getVoteCounts();
    } catch (err: any) {
      this.statusMessage = err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
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

  get currentSession(): SessionResult | null {
    return this.sessionHistory[this.currentHistoryIndex] ?? null;
  }

  getWinner(session: SessionResult): string {
    if (!session.counts.length) return 'No votes';
    const max = Math.max(...session.counts);
    const idx = session.counts.indexOf(max);
    return session.candidates[idx];
  }

  getBarWidth(count: number): number {
  const max = Math.max(...this.voteCounts.map(v => v.count), 1);
  return Math.round((count / max) * 100);
}

getHistoryBarWidth(session: SessionResult, index: number): number {
  const max = Math.max(...session.counts, 1);
  return Math.round((session.counts[index] / max) * 100);
}
}
