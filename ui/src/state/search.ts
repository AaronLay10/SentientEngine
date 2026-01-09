import { create } from 'zustand';

interface SearchState {
  query: string;
  isActive: boolean;

  // Actions
  setQuery: (query: string) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  isActive: false,

  setQuery: (query) =>
    set({
      query,
      isActive: query.trim().length > 0,
    }),

  clearSearch: () =>
    set({
      query: '',
      isActive: false,
    }),
}));
