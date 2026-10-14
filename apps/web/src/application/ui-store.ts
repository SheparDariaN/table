import { create } from "zustand";

type UiState = Readonly<{
  navOpen: boolean;
  toggleNav: () => void;
}>;

export const useUiStore = create<UiState>((set) => ({
  navOpen: false,
  toggleNav: () => set((state) => ({ navOpen: !state.navOpen })),
}));
