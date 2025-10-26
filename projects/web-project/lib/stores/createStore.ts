import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { StateCreator } from 'zustand';

const isDev = process.env.NODE_ENV !== 'production';

export type AppStateCreator<T> = StateCreator<
  T,
  [['zustand/immer', never], ['zustand/devtools', never]]
>;

export function createAppStore<T>(initializer: AppStateCreator<T>) {
  return create<T>()(devtools(immer(initializer), { enabled: isDev }));
}
