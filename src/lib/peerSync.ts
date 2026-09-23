/**
 * peerSync.ts
 * Real cross-device persistent sync using PeerJS (WebRTC peer-to-peer).
 *
 * Flow:
 *  1. Device A (Host): generates 6-digit code → waits for guest
 *  2. Device B (Guest): enters 6-digit code → connects → check digits match
 *  3. Device A allows connection → sends initial snapshot
 *  4. LiveSyncManager keeps the WebRTC DataConnection open permanently!
 *  5. Whenever either device logs a spend, bill, debt, balance, or setting,
 *     it broadcasts the change to the other device in real time.
 */

import Peer, { DataConnection } from 'peerjs';
import { createPlannerSnapshot, applyPlannerSnapshot, SyncPayload } from './syncEngine';

// ──────────────────────────────────────────────
// Helpers & Config
// ──────────────────────────────────────────────

const PEER_PREFIX = 'steadybudget';

/** Map 6-digit clean code → PeerJS peer ID */
export function codeToPeerId(clean: string): string {
  return `${PEER_PREFIX}-${clean}`;
}

/** Shared PeerJS server config with public STUN servers */
export const PEER_CFG = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};

/** Generate a random 6-digit display code */
export function generatePeerSyncCode(): { display: string; clean: string } {
  const num = String(Math.floor(100000 + Math.random() * 900000));
  return {
    display: `${num.slice(0, 3)} ${num.slice(3, 6)}`,
    clean: num,
  };
}

/** Generate 3-digit check number for visual verification */
export function generateCheckDigits(): string {
  return String(Math.floor(100 + Math.random() * 900));
}

// ──────────────────────────────────────────────
// LiveSyncManager (Permanent Cross-Device Sync)
// ──────────────────────────────────────────────

class LiveSyncManager {
  private peer: Peer | null = null;
  private activeConns: Set<DataConnection> = new Set();
  private debounceTimer: any = null;
  private isApplyingRemote = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('steady_broadcast_local_change', () => {
        this.queueBroadcast();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.ensureConnected();
        }
      });
    }
  }

  public init() {
    this.ensureConnected();
  }

  public attachConnection(conn: DataConnection, peer?: Peer | null, role?: 'host' | 'guest', code?: string) {
    if (peer) this.peer = peer;
    if (role) localStorage.setItem('steady_peer_role', role);
    if (code) localStorage.setItem('steady_paired_code', code);
    this.setupConnection(conn);
  }

  private setupConnection(conn: DataConnection) {
    this.activeConns.add(conn);

    conn.on('data', async (raw: any) => {
      if (raw && typeof raw === 'object' && raw.type === 'LIVE_UPDATE' && raw.snapshot) {
        this.isApplyingRemote = true;
        try {
          await applyPlannerSnapshot(raw.snapshot);
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          localStorage.setItem('budget-last-sync-time', now);
        } finally {
          setTimeout(() => {
            this.isApplyingRemote = false;
          }, 500);
        }
      }
    });

    conn.on('close', () => {
      this.activeConns.delete(conn);
    });

    conn.on('error', () => {
      this.activeConns.delete(conn);
    });
  }

  public ensureConnected() {
    if (typeof window === 'undefined') return;
    const pairedCode = localStorage.getItem('steady_paired_code');
    const role = localStorage.getItem('steady_peer_role');
    if (!pairedCode) return;

    // Check if any open connection already exists
    let hasOpen = false;
    for (const c of this.activeConns) {
      if (c.open) {
        hasOpen = true;
        break;
      }
    }
    if (hasOpen) return;

    if (role === 'guest') {
      if (!this.peer || this.peer.destroyed) {
        this.peer = new Peer(PEER_CFG as any);
      }
      const tryConnect = () => {
        try {
          const conn = this.peer!.connect(codeToPeerId(pairedCode), { reliable: true });
          conn.on('open', () => {
            this.setupConnection(conn);
          });
        } catch (e) {
          console.warn('Guest reconnect error:', e);
        }
      };

      if (this.peer.open) {
        tryConnect();
      } else {
        this.peer.once('open', tryConnect);
      }
    } else if (role === 'host') {
      if (!this.peer || this.peer.destroyed) {
        this.peer = new Peer(codeToPeerId(pairedCode), PEER_CFG as any);
        this.peer.on('connection', (conn) => {
          this.setupConnection(conn);
        });
      }
    }
  }

  public queueBroadcast(immediate = false) {
    if (this.isApplyingRemote) return; // avoid infinite loop

    clearTimeout(this.debounceTimer);
    const delay = immediate ? 0 : 350;

    this.debounceTimer = setTimeout(async () => {
      try {
        const snapshot = await createPlannerSnapshot();
        this.broadcast(snapshot);
      } catch (e) {
        console.error('Failed to create snapshot for live sync:', e);
      }
    }, delay);
  }

  public broadcast(snapshot: SyncPayload) {
    let sent = false;
    for (const conn of this.activeConns) {
      if (conn.open) {
        try {
          conn.send({ type: 'LIVE_UPDATE', snapshot });
          sent = true;
        } catch (err) {
          console.warn('Failed to send live update:', err);
        }
      }
    }
    if (sent) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem('budget-last-sync-time', now);
    }
  }

  public disconnectAll() {
    for (const conn of this.activeConns) {
      try {
        conn.close();
      } catch {}
    }
    this.activeConns.clear();
    try {
      this.peer?.destroy();
    } catch {}
    this.peer = null;
    localStorage.removeItem('steady_paired_code');
    localStorage.removeItem('steady_peer_role');
  }
}

export const liveSync = new LiveSyncManager();

// ──────────────────────────────────────────────
// HostSession (Device A — shows the code)
// ──────────────────────────────────────────────

export class HostSession {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private checkDigits = '';
  private clean = '';

  async start(
    clean: string,
    onReady: () => void,
    onGuestJoined: (checkDigits: string) => void,
    onError: (msg: string) => void
  ): Promise<void> {
    this.clean = clean;
    const peerId = codeToPeerId(clean);

    this.peer = new Peer(peerId, PEER_CFG as any);

    this.peer.on('open', () => {
      onReady();
    });

    this.peer.on('error', (err: any) => {
      const type = err?.type ?? '';
      if (type === 'unavailable-id') {
        onError('This code is already in use. Tap to generate a new one.');
      } else if (type === 'network' || type === 'server-error') {
        onError('Could not reach the sync service. Check your internet connection.');
      } else {
        onError('Connection error. Please try again.');
      }
    });

    this.peer.on('connection', (conn: DataConnection) => {
      if (this.conn) {
        conn.close();
        return;
      }
      this.conn = conn;
      this.checkDigits = generateCheckDigits();

      const notifyGuest = () => {
        try {
          conn.send({ type: 'CHECK', checkDigits: this.checkDigits });
        } catch (e) {
          console.warn('Failed to send check digits on open:', e);
        }
        onGuestJoined(this.checkDigits);
      };

      if (conn.open) {
        notifyGuest();
      } else {
        conn.on('open', notifyGuest);
      }

      conn.on('data', (data: any) => {
        if (data && typeof data === 'object' && data.type === 'GUEST_READY') {
          notifyGuest();
        }
      });

      conn.on('error', () => {
        onError('The other device disconnected unexpectedly.');
      });

      conn.on('close', () => {
        this.conn = null;
      });
    });
  }

  async allow(onDone: () => void): Promise<void> {
    if (!this.conn || !this.conn.open) {
      return;
    }
    try {
      const snapshot = await createPlannerSnapshot();
      this.conn.send({ type: 'PAYLOAD', snapshot });

      // Hand over connection to liveSync so it stays active!
      liveSync.attachConnection(this.conn, this.peer, 'host', this.clean);

      setTimeout(() => {
        onDone();
      }, 500);
    } catch (err) {
      console.error('Error during allow:', err);
    }
  }

  destroy(): void {
    // Keep liveSync alive if already attached
  }
}

// ──────────────────────────────────────────────
// GuestSession (Device B — enters the code)
// ──────────────────────────────────────────────

export class GuestSession {
  private peer: Peer | null = null;
  private clean = '';

  async join(
    clean: string,
    onCheckDigits: (digits: string) => void,
    onPayload: (snapshot: SyncPayload) => void,
    onError: (msg: string) => void
  ): Promise<void> {
    this.clean = clean;
    this.peer = new Peer(PEER_CFG as any);

    await new Promise<void>((resolve, reject) => {
      this.peer!.on('open', () => resolve());
      this.peer!.on('error', (err: any) => {
        onError('Could not connect to the sync service. Check your internet.');
        reject(err);
      });
    });

    const peerId = codeToPeerId(clean);
    let conn: DataConnection;

    try {
      conn = this.peer!.connect(peerId, { reliable: true });
    } catch {
      onError('Invalid code format. Please check and try again.');
      return;
    }

    const timeout = setTimeout(() => {
      if (!conn?.open) {
        onError('No device found with that code. Make sure the other device is showing the Connect screen.');
      }
    }, 20000);

    const onOpen = () => {
      try {
        conn.send({ type: 'GUEST_READY' });
      } catch (e) {
        console.warn('Could not send GUEST_READY:', e);
      }
    };

    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('error', () => {
      clearTimeout(timeout);
      onError('Could not reach the other device. Check the code and try again.');
    });

    conn.on('data', async (data: unknown) => {
      clearTimeout(timeout);
      const msg = data as { type: string; checkDigits?: string; snapshot?: SyncPayload };

      if (msg.type === 'CHECK' && msg.checkDigits) {
        onCheckDigits(msg.checkDigits);
      } else if (msg.type === 'PAYLOAD' && msg.snapshot) {
        try {
          // Hand over connection to liveSync so it stays active!
          liveSync.attachConnection(conn, this.peer, 'guest', this.clean);
          await applyPlannerSnapshot(msg.snapshot);
          onPayload(msg.snapshot);
        } catch (e) {
          console.error('Error applying payload on guest:', e);
          onError('Received data but could not apply it. Please try again.');
        }
      }
    });
  }

  destroy(): void {
    // Keep liveSync alive if already attached
  }
}
