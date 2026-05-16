import { create } from "zustand";
import { CustomEvent, CustomEventCategory } from "@/types/customEvent";

const STORAGE_KEY = "gkshah_custom_events";

function loadFromStorage(): CustomEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(events: CustomEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

export interface NewCustomEventData {
  title: string;
  description?: string;
  date: string;
  category: CustomEventCategory;
  relatedMemberIds: string[];
  recurring: boolean;
  imageUrl?: string;
  location?: string;
}

interface CustomEventsState {
  events: CustomEvent[];
  isLoaded: boolean;
  load: () => void;
  addEvent: (data: NewCustomEventData) => CustomEvent;
  updateEvent: (id: string, updates: Partial<NewCustomEventData>) => void;
  deleteEvent: (id: string) => void;
}

export const useCustomEventsStore = create<CustomEventsState>((set, get) => ({
  events: [],
  isLoaded: false,

  load: () => {
    if (get().isLoaded) return;
    set({ events: loadFromStorage(), isLoaded: true });
  },

  addEvent: (data) => {
    const now = new Date().toISOString();
    const event: CustomEvent = {
      ...data,
      id: crypto.randomUUID(),
      relatedMemberIds: data.relatedMemberIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    const events = [...get().events, event];
    saveToStorage(events);
    set({ events });
    return event;
  },

  updateEvent: (id, updates) => {
    const events = get().events.map(e =>
      e.id === id
        ? { ...e, ...updates, updatedAt: new Date().toISOString() }
        : e
    );
    saveToStorage(events);
    set({ events });
  },

  deleteEvent: (id) => {
    const events = get().events.filter(e => e.id !== id);
    saveToStorage(events);
    set({ events });
  },
}));
