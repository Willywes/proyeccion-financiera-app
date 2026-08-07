/**
 * Mes que el usuario está mirando. Vive en un store global para que el
 * selector de mes se mantenga al cambiar de pestaña.
 */

import { create } from 'zustand';
import { addMonths, currentMonth } from '../domain/dates';
import type { MonthKey } from '../domain/types';

interface MonthState {
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
}

export const useMonthStore = create<MonthState>((set) => ({
  month: currentMonth(),
  setMonth: (month) => set({ month }),
  goToPreviousMonth: () => set((state) => ({ month: addMonths(state.month, -1) })),
  goToNextMonth: () => set((state) => ({ month: addMonths(state.month, 1) })),
  goToCurrentMonth: () => set({ month: currentMonth() }),
}));
