/**
 * Asistan durumu — zustand. UI'nin tek doğru kaynağı.
 * Ana ekranda chat yok; ephemeral caption ve görev balonları buradan okunur.
 */
import { create } from 'zustand';

export type VisualizerState = 'idle' | 'listening' | 'processing' | 'speaking' | 'muted' | 'error';
export type AssistantMode = 'flash' | 'pro';
export type ConnectionStatus = 'unknown' | 'testing' | 'connected' | 'failed' | 'offline';

export interface TaskBubble {
  id: string;
  title: string;
  detail: string;
  state: 'running' | 'done' | 'error';
  createdAt: number;
}

interface AssistantState {
  status: VisualizerState;
  mode: AssistantMode;
  connection: ConnectionStatus;
  connectionError: string | null;

  /** Ephemeral caption — son duyulan/söylenen tek satır (5sn solar). */
  caption: string;

  /** Görev balonları — köşede saydam, bitince kaybolur. */
  tasks: TaskBubble[];

  /** Gerçek audio seviyeleri (0..1). Audio yoksa 0 kalır; animasyon dürüst kalır. */
  micLevel: number;
  speakLevel: number;

  mutedByUser: boolean;

  setStatus: (s: VisualizerState) => void;
  setMode: (m: AssistantMode) => void;
  setConnection: (c: ConnectionStatus, error?: string | null) => void;
  setCaption: (c: string) => void;
  pushTask: (t: Omit<TaskBubble, 'id' | 'createdAt'>) => string;
  updateTask: (id: string, patch: Partial<Pick<TaskBubble, 'title' | 'detail' | 'state'>>) => void;
  removeTask: (id: string) => void;
  setLevels: (mic: number, speak: number) => void;
  setMuted: (m: boolean) => void;
}

let taskSeq = 0;

/** Balon kaybolma gecikmesi (ms) — biten görev bir süre sonra listeden düşer. */
export const TASK_DONE_LINGER_MS = 4000;

export const useAssistantStore = create<AssistantState>()((set) => ({
  status: 'idle',
  mode: 'flash',
  connection: 'unknown',
  connectionError: null,
  caption: '',
  tasks: [],
  micLevel: 0,
  speakLevel: 0,
  mutedByUser: false,

  setStatus: (status) => set({ status }),
  setMode: (mode) => set({ mode }),
  setConnection: (connection, connectionError = null) => set({ connection, connectionError }),
  setCaption: (caption) => set({ caption }),
  pushTask: (t) => {
    const id = `task-${++taskSeq}`;
    set((s) => ({ tasks: [...s.tasks, { ...t, id, createdAt: Date.now() }] }));
    return id;
  },
  updateTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  setLevels: (micLevel, speakLevel) => set({ micLevel, speakLevel }),
  setMuted: (mutedByUser) => set({ mutedByUser }),
}));
