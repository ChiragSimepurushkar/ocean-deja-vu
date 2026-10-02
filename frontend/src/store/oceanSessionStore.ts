import { create } from 'zustand';

export interface OceanSessionState {
  currentDate: string;
  currentDepth: number;
  currentLat: number;
  currentLon: number;
  activeAlerts: string[];
  setDate: (date: string) => void;
  setDepth: (depth: number) => void;
  setLat: (lat: number) => void;
  setLon: (lon: number) => void;
  setLocation: (lat: number, lon: number) => void;
  setActiveAlerts: (alerts: string[]) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const useOceanSessionStore = create<OceanSessionState>((set) => ({
  currentDate: '2023-01-01',
  currentDepth: 50,
  currentLat: 15.0,
  currentLon: 85.0,
  activeAlerts: [],
  setDate: (date) => set({ currentDate: date }),
  setDepth: (depth) => set({ currentDepth: depth }),
  setLat: (lat) => set({ currentLat: lat }),
  setLon: (lon) => set({ currentLon: lon }),
  setLocation: (lat, lon) => set({ currentLat: lat, currentLon: lon }),
  setActiveAlerts: (alerts) => set({ activeAlerts: alerts }),
  soundEnabled: true,
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}));
