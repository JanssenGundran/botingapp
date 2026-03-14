import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { environment } from '../../environments/environment';

export interface SessionResult {
  sessionId: number;
  candidates: string[];
  counts: number[];
  endedAt: Date;
}

@Injectable({ providedIn: 'root' })
export class BlockchainService {
  private provider: any;
  private signer: any;
  private votingContract: any;
  private tokenContract: any;

  async connectWallet(): Promise<string> {
    if (!(window as any).ethereum) throw new Error(
      'MetaMask not found. On mobile, open this app inside the MetaMask browser.'
    );
    this.provider = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await this.provider.send('eth_accounts', []);
    if (accounts.length === 0) await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== 11155111) throw new Error('Please switch MetaMask to Sepolia testnet');
    this.tokenContract = new ethers.Contract(environment.voteTokenAddress, environment.voteTokenABI, this.signer);
    this.votingContract = new ethers.Contract(environment.votingAddress, environment.votingABI, this.signer);
    return await this.signer.getAddress();
  }

  async getOwner(): Promise<string> {
    return await this.votingContract['owner']();
  }

  async isOwner(): Promise<boolean> {
    const owner = await this.getOwner();
    const address = await this.signer.getAddress();
    return owner.toLowerCase() === address.toLowerCase();
  }

  async checkTokenBalance(): Promise<boolean> {
    const address = await this.signer.getAddress();
    const balance = await this.tokenContract['balanceOf'](address);
    return balance >= ethers.parseEther('1');
  }

  async hasVoted(): Promise<boolean> {
    const address = await this.signer.getAddress();
    const lastVotedSession = await this.votingContract['lastVotedSession'](address);
    const currentSessionId = await this.votingContract['currentSessionId']();
    return Number(lastVotedSession) === Number(currentSessionId);
  }

  async getCandidates(): Promise<string[]> {
    return await this.votingContract['getCandidates']();
  }

  async getSessionActive(): Promise<boolean> {
    return await this.votingContract['sessionActive']();
  }

  async getTimeRemaining(): Promise<number> {
    const t = await this.votingContract['getTimeRemaining']();
    return Number(t);
  }

  async approveAndVote(candidate: string): Promise<void> {
    const approveTx = await this.tokenContract['approve'](
      environment.votingAddress, ethers.parseEther('1')
    );
    await approveTx.wait();
    const voteTx = await this.votingContract['vote'](candidate);
    await voteTx.wait();
  }

  async getVoteCounts(): Promise<{ name: string; count: number }[]> {
    const candidates = await this.getCandidates();
    return Promise.all(candidates.map(async name => {
      const count = await this.votingContract['getVoteCount'](name);
      return { name, count: Number(count) };
    }));
  }

  async getSessionHistory(): Promise<SessionResult[]> {
    const count = Number(await this.votingContract['getSessionHistoryCount']());
    const results: SessionResult[] = [];
    for (let i = 0; i < count; i++) {
      const [sessionId, candidates, counts, endedAt] =
        await this.votingContract['getSessionHistory'](i);
      results.push({
        sessionId: Number(sessionId),
        candidates: [...candidates],
        counts: counts.map((c: any) => Number(c)),
        endedAt: new Date(Number(endedAt) * 1000)
      });
    }
    return results.reverse(); // most recent first
  }

  async issueToken(voterAddress: string): Promise<void> {
    const tx = await this.tokenContract['issueToken'](voterAddress);
    await tx.wait();
  }

  async startSession(candidates: string[], durationSeconds: number): Promise<void> {
    const tx = await this.votingContract['startSession'](candidates, durationSeconds);
    await tx.wait();
  }

  async endSession(): Promise<void> {
    const tx = await this.votingContract['endSession']();
    await tx.wait();
  }
}
