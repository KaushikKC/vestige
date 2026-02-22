import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vestige_favorites';

async function loadFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveFavorites(pdas: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pdas));
  } catch {
    // ignore storage errors
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFavorites().then((pdas) => setFavorites(new Set(pdas)));
  }, []);

  const toggle = useCallback((pda: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(pda)) {
        next.delete(pda);
      } else {
        next.add(pda);
      }
      saveFavorites(Array.from(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (pda: string) => favorites.has(pda),
    [favorites],
  );

  return { favorites, toggle, isFavorite };
}
