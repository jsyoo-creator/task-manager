import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RolePermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';

export function useRolePermissions() {
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'rolePermissions'), snap => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RolePermissions>;
        setRolePermissions({
          manager: { ...DEFAULT_ROLE_PERMISSIONS.manager, ...data.manager },
          user: { ...DEFAULT_ROLE_PERMISSIONS.user, ...data.user },
        });
      }
    });
    return unsub;
  }, []);

  const updateRolePermissions = async (perms: RolePermissions) => {
    await setDoc(doc(db, 'settings', 'rolePermissions'), perms);
  };

  return { rolePermissions, updateRolePermissions };
}
