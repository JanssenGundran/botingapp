import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockchainService, SessionResult } from '../../services/blockchain';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  isConnected = false;
  isOwner = false;
  walletAddress = '';
  statusMessage = '';
  isLoading = false;
  errorMessage = '';
  sessionHistory: SessionResult[] = [];
  currentHistoryIndex = 0;

  // Token issuing
  tokenAddress = '';
  bulkAddresses = '';

  // Session
  sessionActive = false;
  candidatesInput = '';
  durationMinutes = 10;
  timeRemaining = 0;
  voteCounts: { name: string; count: number }[] = [];

  private timerInterval: any;

  constructor(
    private blockchain: BlockchainService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  async connect() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      this.walletAddress = await this.blockchain.connectWallet();
      this.isConnected = true;
      this.isOwner = await this.blockchain.isOwner();
      if (this.isOwner) {
        await this.refreshSession();
      }
    } catch (err: any) {
      this.errorMessage = err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async refreshSession() {
  this.sessionActive = await this.blockchain.getSessionActive();
  this.sessionHistory = await this.blockchain.getSessionHistory();
  if (this.sessionActive) {
    this.timeRemaining = await this.blockchain.getTimeRemaining();
    this.voteCounts = await this.blockchain.getVoteCounts();
    this.startTimer();
  }
  this.cdr.detectChanges();
}

  startTimer() {
  if (this.timerInterval) clearInterval(this.timerInterval);
  this.timerInterval = setInterval(async () => {
    if (this.timeRemaining > 0) {
      this.timeRemaining--;
      this.voteCounts = await this.blockchain.getVoteCounts();
      this.cdr.detectChanges();
    } else {
      clearInterval(this.timerInterval);
      this.sessionActive = false;
      this.statusMessage = 'Session has ended. See results below.';
      this.voteCounts = await this.blockchain.getVoteCounts();
      this.sessionHistory = await this.blockchain.getSessionHistory();
      this.currentHistoryIndex = 0;
      this.cdr.detectChanges();
    }
  }, 1000);
}

  async issueTokenSingle() {
    if (!this.tokenAddress.trim()) return;
    try {
      this.isLoading = true;
      this.statusMessage = 'Issuing token...';
      this.cdr.detectChanges();
      await this.blockchain.issueToken(this.tokenAddress.trim());
      this.statusMessage = `Token issued to ${this.tokenAddress}`;
      this.tokenAddress = '';
    } catch (err: any) {
      this.statusMessage = 'Error: ' + err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async issueTokenBulk() {
    const addresses = this.bulkAddresses
      .split(/[\n,]+/)
      .map(a => a.trim())
      .filter(a => a.length > 0);
    if (addresses.length === 0) return;
    try {
      this.isLoading = true;
      this.statusMessage = `Issuing tokens to ${addresses.length} addresses...`;
      this.cdr.detectChanges();
      for (let i = 0; i < addresses.length; i++) {
        this.statusMessage = `Issuing token ${i + 1}/${addresses.length}...`;
        this.cdr.detectChanges();
        await this.blockchain.issueToken(addresses[i]);
      }
      this.statusMessage = `Tokens issued to ${addresses.length} addresses`;
      this.bulkAddresses = '';
    } catch (err: any) {
      this.statusMessage = 'Error: ' + err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async startSession() {
    const candidates = this.candidatesInput
      .split(/[\n,]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0);
    if (candidates.length < 2) {
      this.statusMessage = 'Please enter at least 2 candidates';
      return;
    }
    try {
      this.isLoading = true;
      this.statusMessage = 'Starting session...';
      this.cdr.detectChanges();
      const durationSeconds = this.durationMinutes * 60;
      await this.blockchain.startSession(candidates, durationSeconds);
      this.statusMessage = 'Session started!';
      this.candidatesInput = '';
      await this.refreshSession();
    } catch (err: any) {
      this.statusMessage = 'Error: ' + err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async endSession() {
  try {
    this.isLoading = true;
    this.statusMessage = 'Ending session...';
    this.cdr.detectChanges();
    await this.blockchain.endSession();
    this.sessionActive = false;
    this.timeRemaining = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    // Reload everything after session ends
    this.voteCounts = await this.blockchain.getVoteCounts();
    this.sessionHistory = await this.blockchain.getSessionHistory();
    this.currentHistoryIndex = 0;
    this.statusMessage = 'Session ended. See results below.';
  } catch (err: any) {
    this.statusMessage = 'Error: ' + err.message;
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
