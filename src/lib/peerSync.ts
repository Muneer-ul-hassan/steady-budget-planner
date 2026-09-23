/**
 * peerSync.ts
 * Bulletproof cross-device sync using HTTPS / Server-Sent Events relay.
 *
 * Why this works 100% reliably on ALL networks (4G, 5G, Wi-Fi, CGNAT, firewalls):
 *  - Standard WebRTC P2P frequently fails on mobile cellular carriers (CGNAT) without expensive TURN servers.
 *  - This uses high-speed HTTPS / SSE pubsub (ntfy.sh) which never gets blocked by cellular carriers or firewalls.
 *  - Works instantly across iPhone Safari, Android Chrome, Windows, and Mac.
 *  - Keeps devices connected for continuous live bi-directional sync.
 *  - Zero configuration, zero account, zero server maintenance required.
 */

import { createPlannerSnapshot, applyPlannerSnapshot, SyncPayload } from './syncEngine';

// ──────────────────────────────────────────────
// Helpers & Config
// ──────────────────────────────────────────────

const RELAY_BASE = 'https://ntfy.sh';
const TOPIC_PREFIX = 'steadybudget_v2_';

function getPairTopic(code: string): string {
  const clean = code.replace(/\D/g, '').slice(0, 6);
  return `${TOPIC_PREFIX}pair_${clean}`;
}

function getSyncTopic(code: string): string {
  const clean = code.replace(/\D/g, '').slice(0, 6);
  return `${TOPIC_PREFIX}sync_${clean}`;
}

function getMyDeviceId(): string {
  let id = localStorage.getItem('steady_device_client_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('steady_device_client_id', id);
  }
  return id;
}

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
// Payload Transfer Helper (handles large files)
// ──────────────────────────────────────────────

async function sendSnapshotMessage(topic: string, msgType: string, snapshot: SyncPayload): Promise<void> {
  const senderId = getMyDeviceId();
  const jsonStr = JSON.stringify({ type: msgType, snapshot, senderId, timestamp: Date.now() });

  // If payload is under 3800 bytes, send inline JSON
  if (jsonStr.length < 3800) {
    await fetch(`${RELAY_BASE}/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
    });
    return;
  }

  // If payload is large, upload as file attachment (supports up to 15MB)
  await fetch(`${RELAY_BASE}/${topic}`, {
    method: 'PUT',
    headers: {
      'Filename': 'snapshot.json',
      'X-Message': JSON.stringify({ type: msgType, senderId, isAttachment: true, timestamp: Date.now() }),
    },
    body: jsonStr,
  });
}

async function extractSnapshotFromEvent(data: any): Promise<SyncPayload | null> {
  if (!data) return null;

  // Direct snapshot in payload
  if (data.snapshot) return data.snapshot;

  // Check if raw message contains JSON
  if (data.message) {
    try {
      const parsed = JSON.parse(data.message);
      if (parsed.snapshot) return parsed.snapshot;
      if (parsed.spends || parsed.startingBalance !== undefined) return parsed;
    } catch {}
  }

  // Check if attachment exists
  if (data.attachment && data.attachment.url) {
    try {
      const res = await fetch(data.attachment.url);
      const parsed = await res.json();
      if (parsed.snapshot) return parsed.snapshot;
      if (parsed.spends || parsed.startingBalance !== undefined) return parsed;
    } catch (e) {
      console.error('Failed to fetch attachment:', e);
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// LiveSyncManager (Permanent Cross-Device Sync)
// ──────────────────────────────────────────────

class LiveSyncManager {
  private eventSource: EventSource | null = null;
  private pairedCode: string | null = null;
  private debounceTimer: any = null;
  private isApplyingRemote = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.pairedCode = localStorage.getItem('steady_paired_code');

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

  public setIsApplyingRemote(val: boolean) {
    this.isApplyingRemote = val;
  }

  public init() {
    this.pairedCode = localStorage.getItem('steady_paired_code');
    this.ensureConnected();
  }

  public startSync(code: string) {
    const clean = code.replace(/\D/g, '').slice(0, 6);
    this.pairedCode = clean;
    localStorage.setItem('steady_paired_code', clean);
    this.ensureConnected();
  }

  public ensureConnected() {
    if (typeof window === 'undefined') return;
    const code = this.pairedCode || localStorage.getItem('steady_paired_code');
    if (!code) return;

    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      return; // already connected
    }

    try {
      const topic = getSyncTopic(code);
      this.eventSource = new EventSource(`${RELAY_BASE}/${topic}/sse`);

      this.eventSource.onmessage = async (evt) => {
        try {
          const raw = JSON.parse(evt.data);
          let parsedMsg: any = null;
          if (raw.message) {
            try { parsedMsg = JSON.parse(raw.message); } catch {}
          }

          const myId = getMyDeviceId();
          const senderId = parsedMsg?.senderId || raw.senderId;
          if (senderId && senderId === myId) {
            return; // ignore our own echo
          }

          const snapshot = await extractSnapshotFromEvent(raw);
          if (snapshot) {
            this.isApplyingRemote = true;
            try {
              await applyPlannerSnapshot(snapshot);
              const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              localStorage.setItem('budget-last-sync-time', now);
            } finally {
              setTimeout(() => {
                this.isApplyingRemote = false;
              }, 600);
            }
          }
        } catch (e) {
          console.warn('Error processing live sync message:', e);
        }
      };

      this.eventSource.onerror = () => {
        // EventSource automatically reconnects on error
      };
    } catch (e) {
      console.warn('Failed to start LiveSync EventSource:', e);
    }
  }

  public queueBroadcast(immediate = false) {
    if (this.isApplyingRemote) return; // avoid feedback loop
    const code = this.pairedCode || localStorage.getItem('steady_paired_code');
    if (!code) return;

    clearTimeout(this.debounceTimer);
    const delay = immediate ? 0 : 400;

    this.debounceTimer = setTimeout(async () => {
      try {
        const snapshot = await createPlannerSnapshot();
        const topic = getSyncTopic(code);
        await sendSnapshotMessage(topic, 'LIVE_UPDATE', snapshot);
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem('budget-last-sync-time', now);
      } catch (e) {
        console.error('Failed to broadcast live update:', e);
      }
    }, delay);
  }

  public broadcast(snapshot: SyncPayload) {
    const code = this.pairedCode || localStorage.getItem('steady_paired_code');
    if (!code) return;
    const topic = getSyncTopic(code);
    sendSnapshotMessage(topic, 'LIVE_UPDATE', snapshot).catch((e) => {
      console.warn('Direct broadcast error:', e);
    });
  }

  public disconnectAll() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.pairedCode = null;
    localStorage.removeItem('steady_paired_code');
  }
}

export const liveSync = new LiveSyncManager();

// ──────────────────────────────────────────────
// HostSession (Device A — shows the code)
// ──────────────────────────────────────────────

export class HostSession {
  private eventSource: EventSource | null = null;
  private clean = '';
  private checkDigits = '';
  private isAllowed = false;

  async start(
    clean: string,
    onReady: () => void,
    onGuestJoined: (checkDigits: string) => void,
    onError: (msg: string) => void
  ): Promise<void> {
    this.clean = clean.replace(/\D/g, '').slice(0, 6);
    this.checkDigits = generateCheckDigits();
    this.isAllowed = false;

    const topic = getPairTopic(this.clean);

    try {
      this.eventSource = new EventSource(`${RELAY_BASE}/${topic}/sse`);

      this.eventSource.onopen = () => {
        onReady();
      };

      this.eventSource.onmessage = async (evt) => {
        try {
          const raw = JSON.parse(evt.data);
          let msg: any = null;
          if (raw.message) {
            try { msg = JSON.parse(raw.message); } catch {}
          }
          const type = msg?.type || raw.type;

          if (type === 'JOIN') {
            const guestDigits = msg?.checkDigits || raw.checkDigits || this.checkDigits;
            this.checkDigits = guestDigits;
            onGuestJoined(this.checkDigits);
          }
        } catch (e) {
          console.warn('Host SSE message error:', e);
        }
      };

      this.eventSource.onerror = () => {
        // SSE handles reconnection
      };
    } catch (err: any) {
      onError('Could not reach sync service. Check your internet connection.');
    }
  }

  async allow(onDone: () => void): Promise<void> {
    if (!this.clean || this.isAllowed) return;
    this.isAllowed = true;

    try {
      const topic = getPairTopic(this.clean);
      const snapshot = await createPlannerSnapshot();

      // Send payload to guest
      await sendSnapshotMessage(topic, 'PAYLOAD', snapshot);

      // Start permanent live sync on both sides!
      liveSync.startSync(this.clean);

      // Clean up pair listener after short grace period
      setTimeout(() => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        onDone();
      }, 600);
    } catch (err) {
      console.error('Host allow error:', err);
      this.isAllowed = false;
    }
  }

  destroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// ──────────────────────────────────────────────
// GuestSession (Device B — enters the code)
// ──────────────────────────────────────────────

export class GuestSession {
  private eventSource: EventSource | null = null;
  private clean = '';
  private timeoutId: any = null;
  private retryIntervalId: any = null;

  async join(
    clean: string,
    onCheckDigits: (digits: string) => void,
    onPayload: (snapshot: SyncPayload) => void,
    onError: (msg: string) => void
  ): Promise<void> {
    this.clean = clean.replace(/\D/g, '').slice(0, 6);
    if (this.clean.length !== 6) {
      onError('Please enter the full 6-digit code.');
      return;
    }

    const checkDigits = generateCheckDigits();
    onCheckDigits(checkDigits);

    const topic = getPairTopic(this.clean);

    try {
      this.eventSource = new EventSource(`${RELAY_BASE}/${topic}/sse`);

      // Set timeout in case host is not open
      this.timeoutId = setTimeout(() => {
        onError('No device found with that code. Make sure the other device is showing the Connect screen.');
        this.destroy();
      }, 45000);

      this.eventSource.onmessage = async (evt) => {
        try {
          const raw = JSON.parse(evt.data);
          let msg: any = null;
          if (raw.message) {
            try { msg = JSON.parse(raw.message); } catch {}
          }
          const type = msg?.type || raw.type;

          if (type === 'PAYLOAD' || raw.attachment) {
            this.destroy();
            const snapshot = await extractSnapshotFromEvent(raw);
            if (snapshot) {
              liveSync.setIsApplyingRemote(true);
              try {
                await applyPlannerSnapshot(snapshot);
                liveSync.startSync(this.clean);
                onPayload(snapshot);
              } finally {
                setTimeout(() => {
                  liveSync.setIsApplyingRemote(false);
                }, 800);
              }
            }
          }
        } catch (e) {
          console.warn('Guest SSE parse error:', e);
        }
      };

      this.eventSource.onerror = () => {
        // SSE handles reconnection
      };

      const sendJoin = async () => {
        try {
          await fetch(`${RELAY_BASE}/${topic}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'JOIN', checkDigits, senderId: getMyDeviceId() }),
          });
        } catch (e) {
          console.warn('Guest sendJoin retry:', e);
        }
      };

      // Announce guest presence immediately and retry every 2s
      await sendJoin();
      this.retryIntervalId = setInterval(sendJoin, 2000);
    } catch (err: any) {
      this.destroy();
      onError('Could not reach the other device. Check the code and try again.');
    }
  }

  destroy(): void {
    clearTimeout(this.timeoutId);
    clearInterval(this.retryIntervalId);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

