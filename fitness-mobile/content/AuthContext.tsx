import AsyncStorage from "@react-native-async-storage/async-storage";
import { migrateOwnedLocalData } from "@/services/local/migrateLocalData";
import React, { createContext, Fragment, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { accountSessionChanged, accountStorage } from '@/services/local/accountStore';
import { clearAccountNotificationDelivery } from '@/services/notifications';

type Ctx = { user: User | null; initializing: boolean };
const AuthContext = createContext<Ctx>({ user: null, initializing: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let revision = 0;
    let alive = true;
    let preparation: Promise<void> = Promise.resolve();
    const unsubscribe = onAuthStateChanged(auth, u => {
      const current = ++revision;
      accountSessionChanged(u?.uid ?? null);
      // Unmount all account screens/providers while native reminders are cleared.
      setInitializing(true); setFailed(false); setUser(u);
      const localStore = accountStorage();
      preparation = preparation.catch(() => {}).then(clearAccountNotificationDelivery).then(async () => {
        if (u) await migrateOwnedLocalData(AsyncStorage, u.uid, localStore.assertCurrent);
      });
      void preparation.then(() => {
        if (alive && current === revision) setInitializing(false);
      }).catch(() => { if (alive && current === revision) setFailed(true); });
    }, () => { setInitializing(true); setFailed(true); });
    return () => { alive = false; revision++; unsubscribe(); };
  }, [retry]);
  return <AuthContext.Provider value={{ user, initializing }}>
    {initializing ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      {failed ? <><Text>Could not prepare private device data and reminders. Retry before opening another account.</Text>
        <Button title="Retry secure account switch" onPress={() => setRetry(n => n + 1)} /></> : <ActivityIndicator accessibilityLabel="Preparing your account" />}
    </View> : <Fragment key={user?.uid ?? 'signed-out'}>{children}</Fragment>}
  </AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
