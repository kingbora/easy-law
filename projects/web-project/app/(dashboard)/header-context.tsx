'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';

type SetActionFn = (node: ReactNode | null) => void;

const DashboardHeaderActionContext = createContext<SetActionFn | null>(null);

interface DashboardHeaderActionProviderProps {
  children: ReactNode;
  setAction: SetActionFn;
}

export function DashboardHeaderActionProvider({ children, setAction }: DashboardHeaderActionProviderProps) {
  return (
    <DashboardHeaderActionContext.Provider value={setAction}>
      {children}
    </DashboardHeaderActionContext.Provider>
  );
}

export function useDashboardHeaderAction(action: ReactNode | null) {
  const setAction = useContext(DashboardHeaderActionContext);

  useEffect(() => {
    if (!setAction) {
      return;
    }

    setAction(action ?? null);

    return () => {
      setAction(null);
    };
  }, [action, setAction]);
}
