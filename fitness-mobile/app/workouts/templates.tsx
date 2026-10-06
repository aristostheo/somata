import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import {
  subscribeWorkoutTemplates,
  type WorkoutTemplate as DbWorkoutTemplate,
} from "@/services/templates";

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

const TAGS = ["All", "Push", "Pull", "Legs", "Core", "Cardio", "Upper", "Lower"];

function extractTags(template: DbWorkoutTemplate) {
  const items = Array.isArray(template.items) ? template.items : [];
  const joined = `${template.name} ${items
    .map((item: any) => item.exercise || "")
    .join(" ")}`.toLowerCase();
  const tags = new Set<string>();
  if (/(bench|press|chest|triceps|shoulder)/.test(joined)) tags.add("Push");
  if (/(row|pulldown|pull|biceps|back|curl)/.test(joined)) tags.add("Pull");
  if (/(squat|leg|hamstring|quad|glute|calf|rdl)/.test(joined)) tags.add("Legs");
  if (/(core|ab|plank)/.test(joined)) tags.add("Core");
  if (/(cardio|run|bike|walk|zone 2)/.test(joined)) tags.add("Cardio");
  if (tags.has("Push") || tags.has("Pull")) tags.add("Upper");
  if (tags.has("Legs")) tags.add("Lower");
  return Array.from(tags);
}

export default function TemplatesLibraryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [templates, setTemplates] = React.useState<DbWorkoutTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  React.useEffect(() => {
    if (!user?.uid) return;
    return subscribeWorkoutTemplates(user.uid, setTemplates);
  }, [user?.uid]);

  const rows = useMemo(() => {
    return templates
      .map((template) => {
        const tags = extractTags(template);
        return {
          ...template,
          tags,
          exercises: Array.isArray(template.items) ? template.items.length : 0,
        };
      })
      .filter((template: any) => !template.archived)
      .filter((template) => {
        const q = query.trim().toLowerCase();
        const queryMatch =
          !q ||
          template.name.toLowerCase().includes(q) ||
          template.tags.some((tag) => tag.toLowerCase().includes(q));
        const filterMatch = filter === "All" || template.tags.includes(filter);
        return queryMatch && filterMatch;
      });
  }, [templates, query, filter]);

  const archivedRows = useMemo(() => {
    return templates
      .map((template) => ({
        ...template,
        tags: extractTags(template),
      }))
      .filter((template: any) => !!template.archived);
  }, [templates]);

  async function startFromTemplate(template: DbWorkoutTemplate) {
    if (!user?.uid) return;
    const items = Array.isArray(template.items)
      ? template.items
      : Array.isArray((template as any).exercises)
      ? (template as any).exercises
      : [];
    const seed = {
      title: template.name,
      exercises: items.map((item: any) => ({
        name: item.exercise ?? item.name ?? "",
        sets: Math.max(1, Number(item.sets || 1)),
        reps: Number(item.reps || 10),
        weightKg: Number(item.weightKg ?? item.weight ?? 0),
        note: item.notes || "",
      })),
    };
    await AsyncStorage.setItem(
      `workout:templateSeed:${user.uid}`,
      JSON.stringify(seed)
    );
    router.push({
      pathname: "/workouts/session",
      params: {
        templateId: template.id,
        templateName: template.name,
        templateLaunch: "1",
      },
    } as any);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Templates</Text>
          <Text style={styles.subtitle}>Search and filter your saved workout templates</Text>
        </View>
      </View>

      <View style={[styles.searchWrap, { borderColor: withAlpha("#FFFFFF", 0.08) }]}>
        <Ionicons name="search" size={16} color={withAlpha("#FFFFFF", 0.58)} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search templates"
          placeholderTextColor={withAlpha("#FFFFFF", 0.38)}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {TAGS.map((tag) => {
          const active = tag === filter;
          return (
            <Pressable
              key={tag}
              onPress={() => setFilter(tag)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary || "#6C63FF" : "#1A1A24",
                  borderColor: active
                    ? colors.primary || "#6C63FF"
                    : withAlpha("#FFFFFF", 0.08),
                },
              ]}
            >
              <Text style={[styles.filterChipText, { color: "#FFFFFF" }]}>{tag}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {rows.map((template) => (
          <Pressable
            key={template.id}
            onPress={() => startFromTemplate(template as any)}
            style={[styles.card, { borderColor: withAlpha("#FFFFFF", 0.08) }]}
          >
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>
                  {template.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{template.name}</Text>
                <Text style={styles.cardSub}>
                  {template.exercises} exercises
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={withAlpha("#FFFFFF", 0.42)} />
            </View>
            <View style={styles.tagRow}>
              {template.tags.length ? (
                template.tags.slice(0, 4).map((tag) => (
                  <View key={`${template.id}-${tag}`} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.tagChip}>
                  <Text style={styles.tagText}>General</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}

        {!rows.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matching templates</Text>
            <Text style={styles.emptySub}>Try a different filter or save a workout as a template first.</Text>
          </View>
        ) : null}

        {archivedRows.length ? (
          <View style={styles.archivedSection}>
            <Text style={styles.archivedTitle}>Archived</Text>
            {archivedRows.map((template) => (
              <View
                key={`archived-${template.id}`}
                style={[styles.card, { borderColor: withAlpha("#FFFFFF", 0.08), opacity: 0.72 }]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.iconBox}>
                    <Text style={styles.iconText}>
                      {template.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{template.name}</Text>
                    <Text style={styles.cardSub}>Archived template</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0D0D0F", paddingTop: 64, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1A1A24",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: "rgba(255,255,255,0.58)", fontSize: 13, marginTop: 4, fontWeight: "700" },
  searchWrap: {
    marginTop: 18,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#1A1A24",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  filterRow: { gap: 8, paddingVertical: 14 },
  filterChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterChipText: { fontSize: 12, fontWeight: "800" },
  list: { paddingBottom: 32, gap: 10 },
  card: {
    backgroundColor: "#1A1A24",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(108,99,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  cardTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4, fontWeight: "700" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tagText: { color: "rgba(255,255,255,0.64)", fontSize: 11, fontWeight: "700" },
  emptyCard: {
    marginTop: 6,
    backgroundColor: "#1A1A24",
    borderRadius: 18,
    padding: 16,
  },
  emptyTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  emptySub: { color: "rgba(255,255,255,0.58)", fontSize: 13, marginTop: 6, lineHeight: 18 },
  archivedSection: { marginTop: 16, gap: 10 },
  archivedTitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
