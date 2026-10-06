// components/profile/bodyMetrics/MetricPickerSheet.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useReducedMotion } from "react-native-reanimated";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";

const ITEM_H = 44;
const VISIBLE = 7; // odd number looks most "wheel-like"
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  unitLabel?: string; // e.g. "lb", "cm", "%"
  values: number[]; // numeric options
  value: number | null; // selected numeric, or null
  formatValue?: (v: number) => string;
  allowNull?: boolean;
  nullLabel?: string; // "Not set"
  step?: number; // stepper amount
  min?: number;
  max?: number;
  onClose: () => void;
  onChange: (v: number | null) => void;
};

export default function MetricPickerSheet({
  open,
  title,
  subtitle,
  unitLabel,
  values,
  value,
  formatValue,
  allowNull,
  nullLabel = "Not set",
  step = 1,
  min,
  max,
  onClose,
  onChange,
}: Props) {
  const { colors, isDark } = useProfileFlowTheme();
  const reduceMotion = useReducedMotion();
  const listRef = useRef<FlatList<number>>(null);

  const indexForValue = useMemo(() => {
    if (value == null) return 0;
    const idx = values.indexOf(value);
    return Math.max(0, idx);
  }, [value, values]);

  const [internal, setInternal] = useState<number | null>(value ?? null);

  useEffect(() => {
    setInternal(value ?? null);
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    // scroll after mount
    const t = setTimeout(() => {
      if (value == null) {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      } else {
        listRef.current?.scrollToOffset({
          offset: indexForValue * ITEM_H,
          animated: false,
        });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [open, indexForValue, value]);

  const display = (v: number) => (formatValue ? formatValue(v) : `${v}`);

  const clamp = (v: number) => {
    let x = v;
    if (min != null) x = Math.max(min, x);
    if (max != null) x = Math.min(max, x);
    return x;
  };

  const nudge = async (dir: -1 | 1) => {
    try {
      await Haptics.selectionAsync();
    } catch {}

    if (internal == null) {
      const fallback = values[0] ?? 0;
      const next = clamp(fallback);
      setInternal(next);
      onChange(next);
      return;
    }

    const next = clamp(internal + dir * step);

    // snap to nearest allowed value in values array
    const nearest = values.reduce(
      (best, cur) =>
        Math.abs(cur - next) < Math.abs(best - next) ? cur : best,
      values[0]
    );

    setInternal(nearest);
    onChange(nearest);

    const idx = values.indexOf(nearest);
    if (idx >= 0) {
      listRef.current?.scrollToOffset({ offset: idx * ITEM_H, animated: true });
    }
  };

  const onMomentumEnd = async (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_H);
    const picked = values[idx];
    if (picked == null) return;

    if (picked !== internal) {
      try {
        await Haptics.selectionAsync();
      } catch {}
      setInternal(picked);
      onChange(picked);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface1,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {!!subtitle && (
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                {subtitle}
              </Text>
            )}
          </View>

          <Pressable
            onPress={async () => {
              try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              onClose();
            }}
            style={({ pressed }) => [
              styles.doneBtn,
              {
                backgroundColor: pressed
                  ? isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.06)"
                  : isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            <Text style={[styles.doneText, { color: colors.text }]}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => nudge(-1)}
            style={({ pressed }) => [
              styles.stepBtn,
              {
                backgroundColor: pressed
                  ? isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.06)"
                  : isDark
                  ? "rgba(255,255,255,0.07)"
                  : "rgba(0,0,0,0.03)",
              },
            ]}
          >
            <Text style={[styles.stepTxt, { color: colors.text }]}>−</Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.preview, { color: colors.text }]}>
              {internal == null
                ? nullLabel
                : `${display(internal)}${unitLabel ? ` ${unitLabel}` : ""}`}
            </Text>
            {!!allowNull && (
              <Text style={[styles.previewHint, { color: colors.muted }]}>
                Optional
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => nudge(1)}
            style={({ pressed }) => [
              styles.stepBtn,
              {
                backgroundColor: pressed
                  ? isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.06)"
                  : isDark
                  ? "rgba(255,255,255,0.07)"
                  : "rgba(0,0,0,0.03)",
              },
            ]}
          >
            <Text style={[styles.stepTxt, { color: colors.text }]}>+</Text>
          </Pressable>
        </View>

        <View style={styles.wheelWrap}>
          <View
            pointerEvents="none"
            style={[
              styles.selectionBand,
              {
                borderColor: isDark
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(0,0,0,0.10)",
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.02)",
              },
            ]}
          />
          <FlatList
            ref={listRef}
            data={values}
            keyExtractor={(v) => `v:${v}`}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate={Platform.OS === "ios" ? "fast" : 0.98}
            contentContainerStyle={{ paddingVertical: PAD }}
            onMomentumScrollEnd={onMomentumEnd}
            renderItem={({ item, index }) => {
              const selected = item === internal;
              return (
                <View style={[styles.item, { height: ITEM_H }]}>
                  <Text
                    style={[
                      styles.itemText,
                      {
                        color: selected ? colors.text : colors.muted,
                        opacity: selected ? 1 : 0.65,
                      },
                    ]}
                  >
                    {display(item)}
                    {unitLabel ? ` ${unitLabel}` : ""}
                  </Text>
                </View>
              );
            }}
          />
        </View>

        {!!allowNull && (
          <View style={styles.footer}>
            <Pressable
              onPress={async () => {
                try {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setInternal(null);
                onChange(null);
              }}
              style={({ pressed }) => [
                styles.clearBtn,
                {
                  backgroundColor: pressed
                    ? isDark
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(0,0,0,0.06)"
                    : isDark
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(0,0,0,0.03)",
                },
              ]}
            >
              <Text style={[styles.clearTxt, { color: colors.text }]}>
                Clear ({nullLabel})
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 18,
    borderWidth: 0,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  doneBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 12,
  },
  doneText: { fontSize: 14, fontWeight: "600" },

  controls: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepBtn: {
    width: 46,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTxt: { fontSize: 22, fontWeight: "600" },
  preview: { fontSize: 16, fontWeight: "800" },
  previewHint: { fontSize: 12, marginTop: 2 },

  wheelWrap: {
    height: ITEM_H * VISIBLE,
    position: "relative",
  },
  selectionBand: {
    position: "absolute",
    left: 12,
    right: 12,
    top: PAD,
    height: ITEM_H,
    borderRadius: 14,
    borderWidth: 1,
  },
  item: { alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: 18, fontWeight: "800" },

  footer: { padding: 14, paddingTop: 12 },
  clearBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  clearTxt: { fontSize: 14, fontWeight: "800" },
});
