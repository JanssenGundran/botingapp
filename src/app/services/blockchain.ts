import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { environment } from '../../environments/environment';

export interface PositionResult {
  positionName: string;
  candidates: string[];
  counts: number[];
}

export interface PositionData {
  name: string;
  candidates: string[];
  voteCounts: number[];
}

export interface ActiveSession {
  id: number;
  name: string;
  endTime: number;
  active: boolean;
  positions: PositionData[];
  hasVoted: boolean;
  timeRemaining: number;
}

export interface SessionHistoryItem {
  sessionId: number;
  sessionName: string;
  endedAt: Date;
  positions: PositionResult[];
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

  async getActiveSessions(): Promise<ActiveSession[]> {
    const address = await this.signer.getAddress();
    const ids: bigint[] = await this.votingContract['getActiveSessions']();
    const sessions: ActiveSession[] = [];

    for (const id of ids) {
      const [name, endTime, active, positionNames] =
        await this.votingContract['getSessionInfo'](id);

      const positions: PositionData[] = [];
      for (const posName of positionNames) {
        const candidates: string[] = await this.votingContract['getPositionCandidates'](id, posName);
        const voteCounts = await Promise.all(
          candidates.map((c: string) =>
            this.votingContract['getVoteCount'](id, posName, c).then(Number)
          )
        );
        positions.push({ name: posName, candidates, voteCounts });
      }

      const hasVoted = await this.votingContract['hasVoted'](id, address);
      const timeRemaining = Number(await this.votingContract['getTimeRemaining'](id));

      sessions.push({
        id: Number(id),
        name,
        endTime: Number(endTime),
        active,
        positions,
        hasVoted,
        timeRemaining
      });
    }

    return sessions;
  }

  async approveAndVote(
    sessionId: number,
    positions: string[],
    candidates: string[]
  ): Promise<void> {
    const approveTx = await this.tokenContract['approve'](
      environment.votingAddress, ethers.parseEther('1')
    );
    await approveTx.wait();
    const voteTx = await this.votingContract['vote'](sessionId, positions, candidates);
    await voteTx.wait();
  }

  async getSessionHistory(): Promise<SessionHistoryItem[]> {
  const count = Number(await this.votingContract['getSessionHistoryCount']());
  console.log('history count from contract:', count);
  const results: SessionHistoryItem[] = [];

  for (let i = 0; i < count; i++) {
    const [sessionId, sessionName, endedAt, positionNames] =
      await this.votingContract['getSessionHistory'](i);
    console.log(`history[${i}]:`, { sessionId, sessionName, endedAt, positionNames });

    const positions: PositionResult[] = [];
    for (let j = 0; j < positionNames.length; j++) {
      const [positionName, candidates, counts] =
        await this.votingContract['getHistoryPositionResults'](i, j);
      console.log(`history[${i}] position[${j}]:`, { positionName, candidates, counts });
      positions.push({
        positionName,
        candidates: [...candidates],
        counts: counts.map((c: any) => Number(c))
      });
    }

    results.push({
      sessionId: Number(sessionId),
      sessionName,
      endedAt: new Date(Number(endedAt) * 1000),
      positions
    });
  }

  console.log('final results before reverse:', results);
  return results.reverse();
}

  async issueToken(voterAddress: string): Promise<void> {
    const tx = await this.tokenContract['issueToken'](voterAddress);
    await tx.wait();
  }

  async createSession(
    name: string,
    positionNames: string[],
    candidates: string[][],
    durationSeconds: number
  ): Promise<void> {
    const tx = await this.votingContract['createSession'](
      name, positionNames, candidates, durationSeconds
    );
    await tx.wait();
  }

  async endSession(sessionId: number): Promise<void> {
    const tx = await this.votingContract['endSession'](sessionId);
    await tx.wait();
  }
}
