import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredAsset {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  width: number;
  height: number;
}

interface LastAction {
  type: 'kept' | 'deleted';
  asset: StoredAsset;
}

interface DeletedContextType {
  deletedAssets: StoredAsset[];
  keptIds: string[];
  lastAction: LastAction | null;
  isLoaded: boolean;
  addDeleted: (asset: StoredAsset) => void;
  addKept: (asset: StoredAsset) => void;
  recoverAsset: (id: string) => void;
  recoverAll: () => void;
  removeFromDeleted: (ids: string[]) => void;
  undoLast: () => void;
}

const DeletedContext = createContext<DeletedContextType | null>(null);

const DELETED_KEY = '@swipeandclean_deleted';
const KEPT_KEY = '@swipeandclean_kept';

export function DeletedProvider({ children }: { children: React.ReactNode }) {
  const [deletedAssets, setDeletedAssets] = useState<StoredAsset[]>([]);
  const [keptIds, setKeptIds] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      try {
        const [deletedRaw, keptRaw] = await Promise.all([
          AsyncStorage.getItem(DELETED_KEY),
          AsyncStorage.getItem(KEPT_KEY),
        ]);
        if (deletedRaw) setDeletedAssets(JSON.parse(deletedRaw));
        if (keptRaw) setKeptIds(JSON.parse(keptRaw));
      } catch (e) {
        console.warn('Failed to load persisted data:', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(
    async (deleted: StoredAsset[], kept: string[]) => {
      try {
        await Promise.all([
          AsyncStorage.setItem(DELETED_KEY, JSON.stringify(deleted)),
          AsyncStorage.setItem(KEPT_KEY, JSON.stringify(kept)),
        ]);
      } catch (e) {
        console.warn('Failed to persist data:', e);
      }
    },
    []
  );

  const addDeleted = useCallback(
    (asset: StoredAsset) => {
      setDeletedAssets((prev) => {
        const next = [asset, ...prev];
        persist(next, keptIds);
        return next;
      });
      setLastAction({ type: 'deleted', asset });
    },
    [keptIds, persist]
  );

  const addKept = useCallback(
    (asset: StoredAsset) => {
      setKeptIds((prev) => {
        const next = [...prev, asset.id];
        persist(deletedAssets, next);
        return next;
      });
      setLastAction({ type: 'kept', asset });
    },
    [deletedAssets, persist]
  );

  const recoverAsset = useCallback(
    (id: string) => {
      setDeletedAssets((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persist(next, keptIds);
        return next;
      });
    },
    [keptIds, persist]
  );

  const recoverAll = useCallback(() => {
    setDeletedAssets([]);
    persist([], keptIds);
  }, [keptIds, persist]);

  const removeFromDeleted = useCallback(
    (ids: string[]) => {
      setDeletedAssets((prev) => {
        const next = prev.filter((a) => !ids.includes(a.id));
        persist(next, keptIds);
        return next;
      });
    },
    [keptIds, persist]
  );

  const undoLast = useCallback(() => {
    if (!lastAction) return;
    if (lastAction.type === 'deleted') {
      setDeletedAssets((prev) => {
        const next = prev.filter((a) => a.id !== lastAction.asset.id);
        persist(next, keptIds);
        return next;
      });
    } else {
      setKeptIds((prev) => {
        const next = prev.filter((id) => id !== lastAction.asset.id);
        persist(deletedAssets, next);
        return next;
      });
    }
    setLastAction(null);
  }, [lastAction, keptIds, deletedAssets, persist]);

  return (
    <DeletedContext.Provider
      value={{
        deletedAssets,
        keptIds,
        lastAction,
        isLoaded,
        addDeleted,
        addKept,
        recoverAsset,
        recoverAll,
        removeFromDeleted,
        undoLast,
      }}
    >
      {children}
    </DeletedContext.Provider>
  );
}

export function useDeleted() {
  const ctx = useContext(DeletedContext);
  if (!ctx) throw new Error('useDeleted must be used inside DeletedProvider');
  return ctx;
}
