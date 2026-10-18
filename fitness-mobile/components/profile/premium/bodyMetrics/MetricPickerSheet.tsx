import { Button, Choice, Heading, IconButton, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
// components/profile/bodyMetrics/MetricPickerSheet.tsx
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

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
  const { D, F } = useSomataTheme();

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
    } catch { }

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
      } catch { }
      setInternal(picked);
      onChange(picked);
    }
  };

  return (<TaskSheet title={title} visible={open} onClose={onClose}>
    <Text style={F.body}>{subtitle}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconButton icon="remove" label={`Decrease ${title}`} onPress={() => nudge(-1)} />
      <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
        <Text style={{ ...F.value, fontSize: 42 }}>{internal == null ? nullLabel : display(internal)}</Text>
        <Text style={F.caption}>{unitLabel}</Text>
      </View>
      <IconButton icon="add" label={`Increase ${title}`} onPress={() => nudge(1)} />
    </View>
    <Heading title="Choose a value" />
    <FlatList horizontal data={values} keyExtractor={v => String(v)} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} renderItem={({ item: v }) => <Choice label={display(v)} selected={internal === v} onPress={() => { setInternal(v); onChange(v); Haptics.selectionAsync().catch(() => { }); }} />} />
    {allowNull && <Button label={nullLabel} onPress={() => { setInternal(null); onChange(null); }} />}
    <Button primary label="Done" onPress={onClose} />
  </TaskSheet>
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
