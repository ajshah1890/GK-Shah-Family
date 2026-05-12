import { useState, useEffect } from 'react';

const ADMIN_KEY = 'gkshah_admin_mode';
const DEFAULT_PASSWORD = 'gkshah2024';

export function useAdminMode() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem(ADMIN_KEY) === 'true');
  }, []);

  const login = (password: string): boolean => {
    // Get stored password or use default
    const storedPassword = localStorage.getItem('gkshah_admin_password') || DEFAULT_PASSWORD;
    if (password === storedPassword) {
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
    localStorage.setItem('gkshah_admin_password', newPassword);
  };

  return { isAdmin, login, logout, changePassword };
}
