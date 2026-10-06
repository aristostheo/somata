import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import {
  calculateMacros,
  getGoalSetupDraft,
  setGoalSetupDraft,
  type GoalInputs,
} from "@/services/macroCalculator";

function rebalanceRatios(
  current: { protein: number; carbs: number; fat: number },
  key: "protein" | "carbs" | "fat",
  nextValue: number
) {
  const next = { ...current, [key]: nextValue };
  const otherKeys = (["protein", "carbs", "fat"] as const).filter((k) => k !== key);
  const otherTotal = otherKeys.reduce((sum, item) => sum + current[item], 0);
  const remaining = Math.max(0, 100 - nextValue);

  if (otherTotal <= 0) {
    next[otherKeys[0]] = Math.round(remaining / 2);
    next[otherKeys[1]] = 100 - nextValue - next[otherKeys[0]];
    return next;
  }

  next[otherKeys[0]] = Math.round((current[otherKeys[0]] / otherTotal) * remaining);
  next[otherKeys[1]] = 100 - nextValue - next[otherKeys[0]];
  return next;
}

export default function GoalAdvancedScreen() {
  const { colors } = useProfileFlowTheme();
  const router = useRouter();
  const [draft, setDraft] = useState<GoalInputs | null>(null);
  const [bodyFatInput, setBodyFatInput] = useState("");

  useEffect(() => {
    const current = getGoalSetupDraft();
    if (!current) return;
    setDraft(current);
    setBodyFatInput(
      current.bodyFatPercent != null ? String(current.bodyFatPercent) : ""
    );
  }, []);

  const result = useMemo(() => (draft ? calculateMacros(draft) : null), [draft]);

  const updateDraft = (patch: Partial<GoalInputs>) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      setGoalSetupDraft(next);
      return next;
    });
  };

  if (!draft || !result) return null;

  const leanMass =
    draft.bodyFatPercent != null
      ? draft.currentWeight * (1 - draft.bodyFatPercent / 100)
      : null;

  const proteinPctWarning =
    draft.manualMacroRatios != null && draft.manualMacroRatios.protein < 25;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlowAtmosphere />
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface3,
            borderWidth: 0,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          Goal setup
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <SectionLabel colors={colors} title="Advanced" />

        <Card colors={colors}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}>
              BMR formula
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              Choose the same calorie model you trust elsewhere.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                ["mifflin", "Mifflin-St Jeor"],
                ["harris_benedict", "Revised Harris-Benedict"],
                ["katch_mcardle", "Katch-McArdle"],
              ].map(([key, label]) => {
                const active = draft.bmrFormula === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() =>
                      updateDraft({
                        bmrFormula: key as GoalInputs["bmrFormula"],
                      })
                    }
                    style={{
                      paddingHorizontal: 12,
                      height: 40,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.accent : colors.surface2,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.buttonText : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: active ? "500" : "400",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {draft.bmrFormula === "katch_mcardle" ? (
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                Best when body fat is set. Falls back to Mifflin-St Jeor if body fat is missing.
              </Text>
            ) : null}
          </View>
        </Card>

        <Card colors={colors}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}>
              I know my maintenance calories
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              Overrides the activity multiplier calculation
            </Text>
            <Toggle
              colors={colors}
              value={draft.manualTDEEOverride != null}
              onChange={(value) =>
                updateDraft({ manualTDEEOverride: value ? result.tdee : null })
              }
            />
            {draft.manualTDEEOverride != null ? (
              <>
                <TextInput
                  value={String(Math.round(draft.manualTDEEOverride))}
                  onChangeText={(value) =>
                    updateDraft({
                      manualTDEEOverride: value ? Number(value) : null,
                    })
                  }
                  keyboardType="number-pad"
                  style={{
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: colors.surface3,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    paddingHorizontal: 14,
                    fontSize: 16,
                  }}
                />
                <Text style={{ color: colors.warning, fontSize: 12 }}>
                  Manual override active. Make sure this reflects your actual
                  maintenance.
                </Text>
              </>
            ) : null}
          </View>
        </Card>

        <Card colors={colors}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}>
              Body fat %
            </Text>
            <TextInput
              value={bodyFatInput}
              onChangeText={(value) => {
                setBodyFatInput(value);
                const parsed = Number(value);
                updateDraft({
                  bodyFatPercent:
                    value === "" || Number.isNaN(parsed) ? null : parsed,
                });
              }}
              keyboardType="decimal-pad"
              placeholder="Optional"
              placeholderTextColor={colors.textTertiary}
              style={{
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.surface3,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.textPrimary,
                paddingHorizontal: 14,
                fontSize: 16,
              }}
            />
            {draft.bodyFatPercent != null &&
            (draft.bodyFatPercent < 3 || draft.bodyFatPercent > 50) ? (
              <Text style={{ color: colors.danger, fontSize: 12 }}>
                Body fat must be between 3% and 50%.
              </Text>
            ) : null}
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {leanMass != null
                ? `Lean mass: ${leanMass.toFixed(1)} kg · Protein calculated from lean mass`
                : "—"}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              Body fat improves protein target accuracy
            </Text>
          </View>
        </Card>

        <Card colors={colors}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}>
              Set my own macro split
            </Text>
            <Toggle
              colors={colors}
              value={draft.manualMacroRatios != null}
              onChange={(value) =>
                updateDraft({
                  manualMacroRatios: value
                    ? { protein: 35, carbs: 40, fat: 25 }
                    : null,
                })
              }
            />

            {draft.manualMacroRatios ? (
              <>
                {(["protein", "carbs", "fat"] as const).map((key) => {
                  const ratios = draft.manualMacroRatios;
                  if (!ratios) return null;
                  return (
                    <View key={key} style={{ gap: 6 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                          {key.charAt(0).toUpperCase() + key.slice(1)} %
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                          {ratios[key]}%
                        </Text>
                      </View>
                      <Slider
                        minimumValue={10}
                        maximumValue={70}
                        step={1}
                        minimumTrackTintColor={colors.accent}
                        maximumTrackTintColor={colors.surface3}
                        thumbTintColor={colors.buttonText}
                        value={ratios[key]}
                        onValueChange={(value: number) =>
                          updateDraft({
                            manualMacroRatios: rebalanceRatios(
                              ratios,
                              key,
                              value
                            ),
                          })
                        }
                      />
                    </View>
                  );
                })}
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {`${result.protein}g protein · ${result.carbs}g carbs · ${result.fat}g fat`}
                </Text>
                {proteinPctWarning ? (
                  <Text style={{ color: colors.warning, fontSize: 12 }}>
                    Low protein may reduce muscle retention.
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        </Card>

        <Pressable onPress={() => updateDraft({
          manualTDEEOverride: null,
          bodyFatPercent: null,
          manualMacroRatios: null,
        })}>
          <Text style={{ color: colors.danger, fontSize: 13 }}>
            Reset advanced settings to recommended →
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Card({ colors, children }: { colors: any; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface1,
        borderWidth: 0,
        borderColor: colors.border,
        borderRadius: 20,
        padding: 16,
      }}
    >
      {children}
    </View>
  );
}

function Toggle({
  colors,
  value,
  onChange,
}: {
  colors: any;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{
        width: 52,
        height: 30,
        borderRadius: 15,
        justifyContent: "center",
        paddingHorizontal: 3,
        backgroundColor: value ? colors.accent : colors.surface3,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.buttonText,
          alignSelf: value ? "flex-end" : "flex-start",
        }}
      />
    </Pressable>
  );
}

function SectionLabel({ colors, title }: { colors: any; title: string }) {
  return (
    <Text
      style={{
        color: colors.textTertiary,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {title}
    </Text>
  );
}
