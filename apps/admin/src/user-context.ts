import { createContext, useContext } from 'react';
import type { AuthUser } from './types';

export const AdminUserContext = createContext<AuthUser | null>(null);

export function useAdminUser(): AuthUser | null {
  return useContext(AdminUserContext);
}
