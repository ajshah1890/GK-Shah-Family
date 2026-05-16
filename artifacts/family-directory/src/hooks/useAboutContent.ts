import { create } from "zustand";

const STORAGE_KEY = "gkshah_about_content";

export interface FamilyValue {
  title: string;
  desc: string;
}

export interface AboutContent {
  story1: string;
  story2: string;
  founderInfo: string;
  motto: string;
  values: FamilyValue[];
  dirDesc: string;
}

const DEFAULT_CONTENT: AboutContent = {
  story1:
    "The G K Shah family traces its roots to the vibrant culture of Gujarat, India. " +
    "Founded on values of hard work, education, and close-knit family bonds, our " +
    "lineage has grown across generations — from humble beginnings in a single " +
    "ancestral home to a sprawling family spread across India and beyond.",
  story2:
    "Shri G K Shah — the patriarch after whom this chronicle is named — embodied " +
    "the spirit of the family: dedication to community, respect for tradition, and " +
    "an unwavering belief in the next generation. His legacy lives on through every " +
    "branch of this directory.",
  founderInfo: "Shri G K Shah — Patriarch & Visionary",
  motto: "Roots that hold, branches that grow.",
  values: [
    { title: "Unity",     desc: "We celebrate every milestone together — births, weddings, and achievements." },
    { title: "Heritage",  desc: "We honour our Gujarati roots while embracing the wider world." },
    { title: "Education", desc: "Every generation has strived to learn, grow, and contribute." },
    { title: "Service",   desc: "Giving back to community is a cornerstone of who we are." },
  ],
  dirDesc:
    "This private, mobile-first web app is the digital home of the G K Shah Family " +
    "Chronicle. It stores all data locally on your device — nothing is sent to any " +
    "server — so your family's information stays completely private.",
};

function loadContent(): AboutContent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONTENT, values: [...DEFAULT_CONTENT.values] };
    return { ...DEFAULT_CONTENT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONTENT, values: [...DEFAULT_CONTENT.values] };
  }
}

function saveContent(content: AboutContent): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  } catch {}
}

interface AboutContentState {
  content: AboutContent;
  isLoaded: boolean;
  load: () => void;
  update: (updates: Partial<AboutContent>) => void;
  reset: () => void;
}

export const useAboutContent = create<AboutContentState>((set, get) => ({
  content: DEFAULT_CONTENT,
  isLoaded: false,

  load: () => {
    if (get().isLoaded) return;
    set({ content: loadContent(), isLoaded: true });
  },

  update: (updates) => {
    const content = { ...get().content, ...updates };
    saveContent(content);
    set({ content });
  },

  reset: () => {
    const content = { ...DEFAULT_CONTENT, values: [...DEFAULT_CONTENT.values] };
    saveContent(content);
    set({ content });
  },
}));
