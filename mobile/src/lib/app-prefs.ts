

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const ADVANCED_KEY = 'spoonful:cooking-advanced';

let advanced = true;
let hydrated = false;
const listeners = new Set<(v: boolean) => void>();

function emit() {
  for (const l of listeners) l(advanced);
}

export function getCookingAdvanced(): boolean {
  return advanced;
}

export async function hydrateCookingAdvanced(): Promise<boolean> {
  if (hydrated) return advanced;
  try {
    const raw = await AsyncStorage.getItem(ADVANCED_KEY);
    if (raw === '0' || raw === 'false') advanced = false;
    if (raw === '1' || raw === 'true') advanced = true;
  } catch {}
  hydrated = true;
  emit();
  return advanced;
}

export async function setCookingAdvanced(next: boolean): Promise<void> {
  advanced = next;
  hydrated = true;
  emit();
  try {
    await AsyncStorage.setItem(ADVANCED_KEY, next ? '1' : '0');
  } catch {}
}

export function useCookingAdvanced(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(advanced);
  useEffect(() => {
    const listener = (v: boolean) => setValue(v);
    listeners.add(listener);
    void hydrateCookingAdvanced();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [value, (v: boolean) => void setCookingAdvanced(v)];
}

const QUICK_REPORT_KEY = 'spoonful:admin-quick-report';

let quickReport = false;
let quickHydrated = false;
const quickListeners = new Set<(v: boolean) => void>();

function emitQuick() {
  for (const l of quickListeners) l(quickReport);
}

export function getAdminQuickReport(): boolean {
  return quickReport;
}

export async function setAdminQuickReport(next: boolean): Promise<void> {
  quickReport = next;
  quickHydrated = true;
  emitQuick();
  try {
    await AsyncStorage.setItem(QUICK_REPORT_KEY, next ? '1' : '0');
  } catch {}
}

export async function hydrateAdminQuickReport(): Promise<boolean> {
  if (quickHydrated) return quickReport;
  try {
    const raw = await AsyncStorage.getItem(QUICK_REPORT_KEY);
    if (raw === '1' || raw === 'true') quickReport = true;
    if (raw === '0' || raw === 'false') quickReport = false;
  } catch {}
  quickHydrated = true;
  emitQuick();
  return quickReport;
}

export function useAdminQuickReport(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(quickReport);
  useEffect(() => {
    const listener = (v: boolean) => setValue(v);
    quickListeners.add(listener);
    void hydrateAdminQuickReport();
    return () => {
      quickListeners.delete(listener);
    };
  }, []);
  return [value, (v: boolean) => void setAdminQuickReport(v)];
}
