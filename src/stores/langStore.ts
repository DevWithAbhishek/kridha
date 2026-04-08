import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "hi" | "en";

interface LangStore {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLangStore = create<LangStore>()(
  persist(
    (set) => ({
      lang: "hi" as const,
      setLang: (lang: Lang) => set({ lang }),
    }),
    {
      name: "kridha-lang",
    },
  ),
);
