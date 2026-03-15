import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockchainService, ActiveSession, SessionHistoryItem } from '../../services/blockchain';

interface PositionInput {
  name: string;
  candidatesText: string;
}

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

  tokenAddress = '';
  bulkAddresses = '';

  newSessionName = '';
  newSessionDuration = 10;
  positions: PositionInput[] = [{ name: '', candidatesText: '' }];

  activeSessions: ActiveSession[] = [];
  sessionHistory: SessionHistoryItem[] = [];
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

  async connect() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      this.walletAddress = await this.blockchain.connectWallet();
      this.isConnected = true;
      this.isOwner = await this.blockchain.isOwner();
      if (this.isOwner) await this.refresh();
    } catch (err: any) {
      this.errorMessage = err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async refresh() {
    this.activeSessions = await this.blockchain.getActiveSessions();
    this.sessionHistory = await this.blockchain.getSessionHistory();
    this.currentHistoryIndex = 0;
    this.startTimer();
    this.cdr.detectChanges();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(async () => {
      for (const session of this.activeSessions) {
        if (session.timeRemaining > 0) {
          session.timeRemaining--;
        } else {
          session.active = false;
        }
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  addPosition() {
    this.positions.push({ name: '', candidatesText: '' });
  }

  removePosition(index: number) {
    if (this.positions.length > 1) this.positions.splice(index, 1);
  }

  async createSession() {
    if (!this.newSessionName.trim()) {
      this.statusMessage = 'Please enter a session name.';
      return;
    }
    const positionNames = this.positions.map(p => p.name.trim()).filter(n => n);
    const candidates = this.positions.map(p =>
      p.candidatesText.split(/[\n,]+/).map(c => c.trim()).filter(c => c)
    );
    if (positionNames.length === 0) {
      this.statusMessage = 'Please add at least one position.';
      return;
    }
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].length < 2) {
        this.statusMessage = `"${positionNames[i]}" needs at least 2 candidates.`;
        return;
      }
    }
    try {
      this.isLoading = true;
      this.statusMessage = 'Creating session...';
      this.cdr.detectChanges();
      await this.blockchain.createSession(
        this.newSessionName.trim(),
        positionNames,
        candidates,
        this.newSessionDuration * 60
      );
      this.statusMessage = `Session "${this.newSessionName}" created!`;
      this.newSessionName = '';
      this.positions = [{ name: '', candidatesText: '' }];
      await this.refresh();
    } catch (err: any) {
      this.statusMessage = 'Error: ' + err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async endSession(sessionId: number, sessionName: string) {
    try {
      this.isLoading = true;
      this.statusMessage = `Ending "${sessionName}"...`;
      this.cdr.detectChanges();
      await this.blockchain.endSession(sessionId);
      this.statusMessage = `"${sessionName}" ended.`;
      await this.refresh();
    } catch (err: any) {
      this.statusMessage = 'Error: ' + err.message;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
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
      .split(/[\n,]+/).map(a => a.trim()).filter(a => a.length > 0);
    if (addresses.length === 0) return;
    try {
      this.isLoading = true;
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
