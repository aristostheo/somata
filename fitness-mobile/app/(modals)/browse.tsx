// app/session/exercise-browser.tsx
// Modal Exercise Browser (opened from session.tsx)
// - Firestore-first (subscribeExercises) + seed fallback
// - Favorites/Recents local
// - Preview sheet with GIF + instructions
// - On "Use Exercise": returns the selected exerciseId via router params

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Platform,
  StatusBar,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { MotiView, AnimatePresence } from "moti";
import { useRouter, useLocalSearchParams } from "expo-router";

import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";

import type { ExerciseDoc, ExerciseFilters } from "@/services/exercises/types";
import { EXERCISE_SEED } from "@/services/exercises/seed";
import { subscribeExercises } from "@/services/exercises/firestore";
import {
  addRecent,
  clearRecents,
  loadFavorites,
  loadRecents,
  toggleFavorite,
} from "@/services/exercises/store";

import { ExerciseCard } from "@/components/exercises/ExerciseCard";
import { FilterBar } from "@/components/exercises/FilterBar";
import { ExercisePreviewSheet } from "@/components/exercises/ExercisePreviewSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
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
      const favs = await loadFavorites();
      const rec = await loadRecents();
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
    const next = await addRecent(e.id);
    setRecents(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setTimeout(() => setPreview(null), 120);
  }, []);

  const onToggleFavorite = useCallback(
    async (id: string) => {
      const next = await toggleFavorite(id, favorites);
      setFavorites(next);
    },
    [favorites]
  );

  const onClearRecents = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
    await clearRecents();
    setRecents([]);
  }, []);

  const onUseExercise = useCallback(
    async (exercise: ExerciseDoc) => {
      const pickedName = (exercise?.name || "").trim();
      if (!pickedName) return;

      // Write selection for the CURRENT session page to consume
      await AsyncStorage.setItem(
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <LinearGradient
        colors={
          isDark
            ? ["rgba(0,0,0,0.0)", "rgba(0,0,0,0.25)"]
            : ["rgba(255,255,255,0.0)", "rgba(0,0,0,0.03)"]
        }
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topPad} />

      {/* Modal Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerBtn,
            {
              borderColor: withAlpha(colors.border, 0.7),
              backgroundColor: withAlpha(colors.card, pressed ? 0.22 : 0.16),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Close exercise browser"
        >
          <Ionicons
            name="close"
            size={18}
            color={withAlpha(colors.text, 0.82)}
          />
        </Pressable>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.h1, { color: colors.text }]}>Browse</Text>
          <Text style={[styles.h2, { color: withAlpha(colors.text, 0.65) }]}>
            {sectionTitle(scope, activeCount)}
          </Text>
        </View>

        {scope === "recent" ? (
          <Pressable
            onPress={onClearRecents}
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                borderColor: withAlpha(colors.border, 0.7),
                backgroundColor: withAlpha(colors.card, pressed ? 0.22 : 0.16),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Clear recent exercises"
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={withAlpha(colors.text, 0.8)}
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => inputRef.current?.focus()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                borderColor: withAlpha(colors.border, 0.7),
                backgroundColor: withAlpha(colors.card, pressed ? 0.22 : 0.16),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Focus search"
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={withAlpha(colors.text, 0.8)}
            />
          </Pressable>
        )}
      </View>

      {/* Segmented */}
      <BlurView
        intensity={isDark ? 20 : 32}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.segmentWrap,
          {
            borderColor: withAlpha(colors.border, isDark ? 0.55 : 0.7),
            backgroundColor: withAlpha(colors.card, isDark ? 0.25 : 0.5),
          },
        ]}
      >
        {segmented.map((s) => {
          const active = scope === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setScope(s.key);
              }}
              style={({ pressed }) => [
                styles.segment,
                active && {
                  backgroundColor: withAlpha(colors.card, isDark ? 0.5 : 0.8),
                  borderColor: withAlpha(colors.border, 0.8),
                },
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${s.label} tab`}
            >
              <Ionicons
                name={s.icon}
                size={16}
                color={withAlpha(colors.text, active ? 0.92 : 0.6)}
                style={{ marginRight: 7 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: withAlpha(colors.text, active ? 0.92 : 0.65) },
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>

      {/* Search + Filters */}
      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <BlurView
          intensity={isDark ? 18 : 30}
          tint={isDark ? "dark" : "light"}
          style={[
            styles.searchWrap,
            {
              borderColor: withAlpha(colors.border, isDark ? 0.55 : 0.7),
              backgroundColor: withAlpha(colors.card, isDark ? 0.22 : 0.45),
            },
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={withAlpha(colors.text, 0.55)}
            style={{ marginRight: 10 }}
          />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises, muscles, equipment…"
            placeholderTextColor={withAlpha(colors.text, 0.45)}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            accessibilityLabel="Search exercises"
          />
          <AnimatePresence>
            {query.length > 0 ? (
              <MotiView
                key="clear"
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "timing", duration: 150 }}
              >
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setQuery("");
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={({ pressed }) => [
                    styles.clearBtn,
                    {
                      backgroundColor: withAlpha(
                        colors.card,
                        pressed ? 0.22 : 0.16
                      ),
                      borderColor: withAlpha(colors.border, 0.7),
                    },
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={16}
                    color={withAlpha(colors.text, 0.75)}
                  />
                </Pressable>
              </MotiView>
            ) : null}
          </AnimatePresence>
        </BlurView>

        <FilterBar
          filters={filters}
          onChange={(next) => {
            Haptics.selectionAsync().catch(() => {});
            setFilters(next);
          }}
        />
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 14,
          paddingBottom: 28,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === "android"}
        renderItem={({ item }) => (
          <ExerciseCard
            item={item}
            isFavorite={favorites.has(item.id)}
            onPress={() => openPreview(item)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="sparkles-outline"
              size={22}
              color={withAlpha(colors.text, 0.5)}
              style={{ marginBottom: 8 }}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: withAlpha(colors.text, 0.85) },
              ]}
            >
              Nothing matches yet
            </Text>
            <Text
              style={[styles.emptySub, { color: withAlpha(colors.text, 0.6) }]}
            >
              Try a shorter search, or broaden filters.
            </Text>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setQuery("");
                setFilters({ muscle: "all", equipment: "all", hasDemo: false });
              }}
              style={({ pressed }) => [
                styles.resetBtn,
                {
                  borderColor: withAlpha(colors.border, 0.7),
                  backgroundColor: withAlpha(
                    colors.card,
                    pressed ? 0.24 : 0.18
                  ),
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
            >
              <Ionicons
                name="refresh"
                size={16}
                color={withAlpha(colors.text, 0.75)}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.resetText,
                  { color: withAlpha(colors.text, 0.85) },
                ]}
              >
                Reset
              </Text>
            </Pressable>
          </View>
        }
      />

      <ExercisePreviewSheet
        visible={previewOpen}
        exercise={preview}
        isFavorite={preview ? favorites.has(preview.id) : false}
        onClose={closePreview}
        onToggleFavorite={() => preview && onToggleFavorite(preview.id)}
        onUse={() => preview && onUseExercise(preview)}
      />
    </View>
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
