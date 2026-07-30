import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SimulatedTimeContextValue {
  simulatedTimeIso: string;
  advanceTime: (hours: number) => void;
}

const SimulatedTimeContext = createContext<SimulatedTimeContextValue>({
  simulatedTimeIso: new Date().toISOString(),
  advanceTime: () => {},
});

export function SimulatedTimeProvider({ children }: { children: ReactNode }) {
  const [simulatedTimeIso, setSimulatedTimeIso] = useState(new Date().toISOString());

  const advanceTime = useCallback((hours: number) => {
    setSimulatedTimeIso((prev) => {
      const t = new Date(prev).getTime() + hours * 60 * 60 * 1000;
      return new Date(t).toISOString();
    });
  }, []);

  return (
    <SimulatedTimeContext.Provider value={{ simulatedTimeIso, advanceTime }}>
      {children}
    </SimulatedTimeContext.Provider>
  );
}

export function useSimulatedTime() {
  return useContext(SimulatedTimeContext);
}
