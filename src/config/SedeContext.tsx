import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SEDES } from './sedes';
import { Sede } from '../types';

interface SedeContextType {
  sede: Sede;
  setSede: (sede: Sede) => void;
  availableSedes: Sede[];
}

const SedeContext = createContext<SedeContextType | null>(null);

export function SedeProvider({ children }: { children: ReactNode }) {
  const [sede, setSedeState] = useState<Sede>(SEDES[0]);

  useEffect(() => {
    const saved = localStorage.getItem('sige_current_sede');
    if (saved) {
      const found = SEDES.find(s => s.id === saved);
      if (found) setSedeState(found);
    }
  }, []);

  const setSede = (newSede: Sede) => {
    setSedeState(newSede);
    localStorage.setItem('sige_current_sede', newSede.id);
  };

  return (
    <SedeContext.Provider value={{ sede, setSede, availableSedes: SEDES }}>
      {children}
    </SedeContext.Provider>
  );
}

export function useSede() {
  const context = useContext(SedeContext);
  if (!context) throw new Error('useSede must be used within SedeProvider');
  return context;
}
