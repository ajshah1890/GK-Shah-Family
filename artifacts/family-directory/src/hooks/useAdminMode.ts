import { useState } from 'react';

const ADMIN_KEY = 'gkshah_admin_mode';
const PASSWORD_KEY = 'gkshah_admin_password';
const DEFAULT_PASSWORD = 'gkshah2024';

function readAdminFromStorage(): boolean {
  try {
    return localStorage.getItem(ADMIN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useAdminMode() {
  // Lazy initialiser reads localStorage synchronously on first render,
  // avoiding the "isAdmin=false" flash that caused the Access Denied bug.
  const [isAdmin, setIsAdmin] = useState<boolean>(readAdminFromStorage);

  const login = (password: string): boolean => {
    const stored = localStorage.getItem(PASSWORD_KEY) ?? DEFAULT_PASSWORD;
    if (password === stored) {
      localStorage.setItem(ADMIN_KEY, 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_KEY);
    setIsAdmin(false);
  };

  const changePassword = (newPassword: string) => {
    localStorage.setItem(PASSWORD_KEY, newPassword);
  };

  return { isAdmin, login, logout, changePassword };
}
