import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { WorkoutIntro, WorkoutStats, WorkoutFields, MovementHeading } from "@/components/workouts/WorkoutTaskUI";
import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
import { Button, Choice, Empty, Field, Heading, IconButton, Item, Panel, TaskPage } from "@/components/somata/TaskUI";
// app/session/exercise-browser.tsx
// Modal Exercise Browser (opened from session.tsx)
// - Firestore-first (subscribeExercises) + seed fallback
// - Favorites/Recents local
// - Preview sheet with GIF + instructions
// - On "Use Exercise": returns the selected exerciseId via router params

import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View
} from "react-native";

import { useTheme } from "@/content/ThemeProvider";

import { subscribeExercises } from "@/services/exercises/firestore";
import { EXERCISE_SEED } from "@/services/exercises/seed";
import {
  addRecent,
  clearRecents,
  loadFavorites,
  loadRecents,
  toggleFavorite,
} from "@/services/exercises/store";
import type { ExerciseDoc, ExerciseFilters } from "@/services/exercises/types";

import { ExercisePreviewSheet } from "@/components/exercises/ExercisePreviewSheet";
import { FilterBar } from "@/components/exercises/FilterBar";

type Scope = "all" | "favorites" | "recent";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function matchesQuery(ex: ExerciseDoc, q: string) {
  if (!q) return true;
  const tokens = normalize(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;

  const hay = [
    ex.name,
    ...(ex.primaryMuscles ?? []),
    ...(ex.secondaryMuscles ?? []),
    ...(ex.equipment ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return tokens.every(
    (t) => hay.includes(t) || hay.split(/\s+/).some((w) => w.startsWith(t))
  );
}

function matchesFilters(ex: ExerciseDoc, f: ExerciseFilters) {
  const muscleOk =
    !f.muscle ||
    f.muscle === "all" ||
    (ex.primaryMuscles ?? []).includes(f.muscle) ||
    (ex.secondaryMuscles ?? []).includes(f.muscle);

  const equipOk =
    !f.equipment ||
    f.equipment === "all" ||
    (ex.equipment ?? []).includes(f.equipment);

  const demoOk = !f.hasDemo || !!ex.images?.gif;

  return muscleOk && equipOk && demoOk;
}

function sectionTitle(scope: Scope, count: number) {
  if (scope === "favorites") return `Favorites • ${count}`;
  if (scope === "recent") return `Recent • ${count}`;
  return `Explore • ${count}`;
}

export default function ExerciseBrowserModal() {
  return <SomataTaskAppearance><ExerciseBrowserModalContent /></SomataTaskAppearance>;
}

function ExerciseBrowserModalContent() {
  const localStore = useAccountStorage();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; }>();
  const { colors, isDark } = useTheme();

  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ExerciseFilters>({
    muscle: "all",
    equipment: "all",
    hasDemo: false,
  });

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recents, setRecents] = useState<string[]>([]);
  const [preview, setPreview] = useState<ExerciseDoc | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Seed first for instant UI, then Firestore hydrates
  const [items, setItems] = useState<ExerciseDoc[]>(EXERCISE_SEED);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const favs = await loadFavorites(localStore);
      const rec = await loadRecents(localStore);
      setFavorites(favs);
      setRecents(rec);
    })();
  }, []);

  useEffect(() => {
    const unsub = subscribeExercises(
      (data) => setItems(data),
      () => {
        // silent fail; seed remains
      },
      { limit: 5000 }
    );
    return () => unsub();
  }, []);

  const dataBase = useMemo(() => {
    if (scope === "favorites") return items.filter((e) => favorites.has(e.id));

    if (scope === "recent") {
      const map = new Map(items.map((e) => [e.id, e] as const));
      return recents.map((id) => map.get(id)).filter(Boolean) as ExerciseDoc[];
    }

    return items;
  }, [scope, favorites, recents, items]);

  const data = useMemo(() => {
    const q = normalize(query);
    return dataBase
      .filter((e) => matchesFilters(e, filters))
      .filter((e) => matchesQuery(e, q));
  }, [dataBase, filters, query]);

  const activeCount = data.length;

  const openPreview = useCallback(async (e: ExerciseDoc) => {
    setPreview(e);
    setPreviewOpen(true);
    const next = await addRecent(e.id, localStore);
    setRecents(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setTimeout(() => setPreview(null), 120);
  }, []);

  const onToggleFavorite = useCallback(
    async (id: string) => {
      const next = await toggleFavorite(id, favorites, localStore);
      setFavorites(next);
    },
    [favorites]
  );

  const onClearRecents = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => { }
    );
    await clearRecents(localStore);
    setRecents([]);
  }, []);

  const onUseExercise = useCallback(
    async (exercise: ExerciseDoc) => {
      const pickedName = (exercise?.name || "").trim();
      if (!pickedName) return;

      // Write selection for the CURRENT session page to consume
      await localStore.setItem(
        "session:browsePick",
        JSON.stringify({
          name: pickedName,
          from: "browse",
          t: Date.now(),
        })
      );

      closePreview();

      // Close the modal -> returns to the SAME session instance (no new stack entry)
      router.back();
    },
    [router, closePreview]
  );

  const segmented = useMemo(
    () => [
      { key: "all" as const, label: "All", icon: "grid-outline" as const },
      {
        key: "favorites" as const,
        label: "Favorites",
        icon: "heart-outline" as const,
      },
      {
        key: "recent" as const,
        label: "Recent",
        icon: "time-outline" as const,
      },
    ],
    []
  );

  return (<><TaskPage scroll={false} title="Exercise library" section="Exercise library" onBack={() => router.back()} action={scope === 'recent' ? <IconButton icon="trash-outline" label="Clear recent exercises" onPress={onClearRecents} /> : undefined}>

    <FlatList ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16 }}>
    <Panel accent><Heading title="Find your movement" detail="Search by name, muscle or equipment. Preview before adding." />
    <Field ref={inputRef} label="Search the library" value={query} onChangeText={setQuery} placeholder="Exercise, muscle, equipment" onSubmitEditing={() => Keyboard.dismiss()} />

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {segmented.map(s => <Choice key={s.key} label={s.label} selected={scope === s.key} onPress={() => { Haptics.selectionAsync().catch(() => { }); setScope(s.key); }} />)}
    </View>

    </Panel>
    <FilterBar filters={filters} onChange={setFilters} />
    <Heading title={sectionTitle(scope, activeCount)} />

    </View>} ListFooterComponent={<Button label="Reset search and filters" onPress={() => { setQuery(''); setFilters({ muscle: 'all', equipment: 'all', hasDemo: false }); }} />} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" data={data} keyExtractor={e => e.id} renderItem={({ item: e }) => <Panel><Item title={e.name} detail={[...(e.primaryMuscles ?? []), ...(e.equipment ?? [])].join(' · ')} onPress={() => openPreview(e)} action={<IconButton icon={favorites.has(e.id) ? 'heart' : 'heart-outline'} label={favorites.has(e.id) ? `Unfavorite ${e.name}` : `Favorite ${e.name}`} onPress={() => onToggleFavorite(e.id)} />} /></Panel>} ListEmptyComponent={<Empty title="No matching movements" detail="Try another search or broaden your filters." />} />


  </TaskPage><ExercisePreviewSheet visible={previewOpen} exercise={preview} isFavorite={preview ? favorites.has(preview.id) : false} onClose={closePreview} onToggleFavorite={() => preview && onToggleFavorite(preview.id)} onUse={() => preview && onUseExercise(preview)} /></>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topPad: { height: Platform.OS === "ios" ? 8 : 10 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  h1: { fontSize: 28, fontWeight: "900", letterSpacing: 0.2 },
  h2: { marginTop: 4, fontSize: 13.5, fontWeight: "700" },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentWrap: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 6,
    flexDirection: "row",
    gap: 6,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: { fontSize: 13.5, fontWeight: "900", letterSpacing: 0.2 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 0,
  },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { marginTop: 28, alignItems: "center", paddingHorizontal: 26 },
  emptyTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
  resetBtn: {
    marginTop: 14,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  resetText: { fontSize: 14, fontWeight: "900" },
});
