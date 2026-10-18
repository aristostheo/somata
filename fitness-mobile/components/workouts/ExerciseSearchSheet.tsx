import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
// components/workouts/ExerciseSearchSheet.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Fuse from "fuse.js";
import seed from "@/assets/exercises.seed.json"; // [{ id, name, primaryMuscles, equipment }]
import { useTheme } from "@/content/ThemeProvider";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";

type Seed = {
  id: string;
  name: string;
  primaryMuscles: string[];
  equipment: string[];
};

const STORAGE_KEY = "exercise_search_recent_v1";
const DEBOUNCE_MS = 180;
const SHEET_MAX = Math.round(Dimensions.get("window").height * 0.88);

export default function ExerciseSearchSheet({
  open,
  onClose,
  onPick,
  onPickItem, // optional: (item: Seed) => void
  suggested = [], // optional: string[]
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseName: string) => void;
  onPickItem?: (item: Seed) => void;
  suggested?: string[];
}) {
  const localStore = useAccountStorage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // ---------- state ----------
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<{ body?: string; equipment?: string }>(
    {}
  );
  const [recents, setRecents] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // stable results: we only swap the list AFTER debounce finishes
  const [stableResults, setStableResults] = useState<Seed[]>([]);
  const isSearching = debouncedQ !== q.trim();

  // ---------- dataset ----------
  const data: Seed[] = useMemo(() => {
    const raw = seed as any;
    return Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.default)
      ? raw.default
      : [];
  }, []);

  // ---------- keyboard listeners ----------
  useEffect(() => {
    const s = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true)
    );
    const h = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false)
    );
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  // ---------- debounce ----------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  // ---------- recents ----------
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const raw = await localStore.getItem(STORAGE_KEY);
        setRecents(raw ? JSON.parse(raw) : []);
      } catch {
        setRecents([]);
      }
    })();
  }, [open]);

  // ---------- open lifecycle ----------
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQ("");
      setFilters({});
      setStableResults([]); // reset between opens
    }
  }, [open]);

  // ---------- fuse (tuned for short queries like "row") ----------
  const fuse = useMemo(
    () =>
      new Fuse(data, {
        keys: [
          { name: "name", weight: 0.72 },
          { name: "primaryMuscles", weight: 0.18 },
          { name: "equipment", weight: 0.1 },
        ],
        threshold: 0.45,
        distance: 100,
        minMatchCharLength: 2,
        ignoreLocation: true,
        findAllMatches: true,
        includeScore: true,
      }),
    [data]
  );

  // ---------- highlight helper ----------
  const highlight = useCallback(
    (text: string, qstr: string) => {
      if (!qstr) return <Text style={{ color: colors.text }}>{text}</Text>;
      const parts = text.split(new RegExp(`(${escapeRegExp(qstr)})`, "ig"));
      return (
        <Text style={{ color: colors.text }}>
          {parts.map((p, i) =>
            p.toLowerCase() === qstr.toLowerCase() ? (
              <Text
                key={i}
                style={{ color: colors.primary, fontWeight: "800" }}
              >
                {p}
              </Text>
            ) : (
              <Text key={i}>{p}</Text>
            )
          )}
        </Text>
      );
    },
    [colors.text, colors.primary]
  );

  // ---------- compute results from debounced query ----------
  const results = useMemo(() => {
    const query = debouncedQ.trim();
    let r: Seed[] = !query ? data : fuse.search(query).map((x) => x.item);

    if (query && r.length === 0) {
      const ql = query.toLowerCase();
      r = data.filter(
        (x) =>
          x.name.toLowerCase().includes(ql) ||
          x.primaryMuscles.some((m) => m.toLowerCase().includes(ql)) ||
          x.equipment.some((e) => e.toLowerCase().includes(ql))
      );
    }

    if (filters.body)
      r = r.filter((x) => x.primaryMuscles.includes(filters.body!));
    if (filters.equipment)
      r = r.filter((x) => x.equipment.includes(filters.equipment!));

    if (query) {
      const ql = query.toLowerCase();
      r = r.slice().sort((a, b) => {
        const as = Number(a.name.toLowerCase().startsWith(ql));
        const bs = Number(b.name.toLowerCase().startsWith(ql));
        if (bs !== as) return bs - as;
        return a.name.localeCompare(b.name);
      });
    }

    return r.slice(0, 200);
  }, [debouncedQ, filters, fuse, data]);

  // commit debounced results to the stable list
  useEffect(() => {
    setStableResults(results);
  }, [results]);

  const empty = stableResults.length === 0 && !isSearching;

  // ---------- actions ----------
  const toggleFilter = (k: "body" | "equipment", v: string) =>
    setFilters((prev) => ({ ...prev, [k]: prev[k] === v ? undefined : v }));

  const clearFilters = () => setFilters({});

  const commitPick = async (item: Seed) => {
    try {
      const next = [item.name, ...recents.filter((n) => n !== item.name)].slice(
        0,
        8
      );
      setRecents(next);
      await localStore.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    onPickItem?.(item);
    onPick(item.name);
    onClose();
  };

  // ---------- UI ----------
  return (
    <Modal
      animationType="slide"
      transparent
      visible={open}
      onRequestClose={onClose}
    >
      {/* overlay captures touches so the screen behind won't scroll */}
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
        onStartShouldSetResponder={() => true}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{
            maxHeight: SHEET_MAX,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            backgroundColor: colors.background,
            paddingTop: 12,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 14,
              marginBottom: 8,
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}
            >
              Browse exercises
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close search"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Search row (stable, with tiny spinner) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 10,
              height: 44,
              gap: 8,
              marginHorizontal: 14,
            }}
          >
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              ref={inputRef}
              placeholder="Type to filter… e.g., row, chest, dumbbell"
              placeholderTextColor={colors.muted}
              value={q}
              onChangeText={(t) => setQ(t)}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{ flex: 1, color: colors.text }}
            />
            {isSearching && (
              <ActivityIndicator size="small" color={colors.muted} />
            )}
            {q.length > 0 && !isSearching && (
              <Pressable
                onPress={() => setQ("")}
                hitSlop={10}
                accessibilityLabel="Clear text"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
            {keyboardVisible && (
              <Pressable
                onPress={() => Keyboard.dismiss()}
                hitSlop={10}
                accessibilityLabel="Hide keyboard"
              >
                <Ionicons name="chevron-down" size={20} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {/* Filters */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              paddingHorizontal: 14,
              marginTop: 10,
            }}
          >
            {[
              { k: "body" as const, v: "chest", label: "Chest" },
              { k: "body" as const, v: "lats", label: "Lats" },
              { k: "body" as const, v: "quadriceps", label: "Quads" },
              { k: "equipment" as const, v: "barbell", label: "Barbell" },
              { k: "equipment" as const, v: "dumbbell", label: "Dumbbell" },
              { k: "equipment" as const, v: "cable-machine", label: "Cable" },
            ].map((c) => {
              const active = (filters as any)[c.k] === c.v;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => toggleFilter(c.k, c.v)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? "rgba(99,102,241,0.12)"
                      : "transparent",
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={{ color: active ? colors.primary : colors.text }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
            {!!(filters.body || filters.equipment) && (
              <Pressable
                onPress={() => setFilters({})}
                hitSlop={8}
                accessibilityLabel="Clear filters"
              >
                <Text
                  style={{
                    color: colors.muted,
                    textDecorationLine: "underline",
                  }}
                >
                  Clear
                </Text>
              </Pressable>
            )}
          </View>

          {/* Results list (always present; empty state lives inside) */}
          <View style={{ flexGrow: 1, minHeight: 280, marginTop: 6 }}>
            <FlatList
              data={stableResults}
              keyExtractor={(x) => x.id}
              keyboardShouldPersistTaps="always" // taps work even with keyboard up
              keyboardDismissMode="on-drag" // drag to hide keyboard (iOS)
              onScrollBeginDrag={() => Keyboard.dismiss()} // hide keyboard on Android scroll
              initialNumToRender={24}
              contentContainerStyle={{
                paddingBottom: insets.bottom + 16,
                flexGrow: 1,
              }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => commitPick(item)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${item.name}`}
                >
                  <View style={{ flexShrink: 1 }}>
                    {highlight(item.name, debouncedQ)}
                    <Text style={{ color: colors.muted, marginTop: 2 }}>
                      {item.primaryMuscles.join(", ")} •{" "}
                      {item.equipment.join(", ")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
              )}
              ListEmptyComponent={
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 24,
                    gap: 8,
                  }}
                >
                  {isSearching ? (
                    <ActivityIndicator />
                  ) : (
                    <>
                      <Ionicons name="search" size={24} color={colors.muted} />
                      <Text
                        style={{ color: colors.muted, textAlign: "center" }}
                      >
                        No matches. Try a different keyword or clear filters.
                      </Text>
                    </>
                  )}
                </View>
              }
              ListFooterComponent={<View style={{ height: 12 }} />}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/* helpers */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
