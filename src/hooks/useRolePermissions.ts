import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RolePermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';

export function useRolePermissions(workplaceId?: string) {
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);

  useEffect(() => {
    if (!workplaceId) {
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      return;
    }
    const unsub = onSnapshot(doc(db, 'settings', `rolePermissions_${workplaceId}`), snap => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RolePermissions>;
        setRolePermissions({
          manager: { ...DEFAULT_ROLE_PERMISSIONS.manager, ...data.manager },
          user: { ...DEFAULT_ROLE_PERMISSIONS.user, ...data.user },
        });
      } else {
        setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      }
    });
    return unsub;
  }, [workplaceId]);

  const updateRolePermissions = async (perms: RolePermissions) => {
    if (!workplaceId) return;
    await setDoc(doc(db, 'settings', `rolePermissions_${workplaceId}`), perms);
  };

  return { rolePermissions, updateRolePermissions };
}
