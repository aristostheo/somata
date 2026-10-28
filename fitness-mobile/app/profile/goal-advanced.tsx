import { ProfileIntro, ProfileSection, ProfileStats } from "@/components/profile/ProfileTaskUI";
import { Button, Choice, Field, Heading, Panel, TaskPage, Toggle as TaskToggle } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Text,
  View
} from "react-native";

import { usePremiumProfileFlowTheme as useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import {
  calculateMacros,
  getGoalSetupDraft,
  setGoalSetupDraft,
  type GoalInputs,
} from "@/services/macroCalculator";

function rebalanceRatios(
  current: { protein: number; carbs: number; fat: number; },
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

function GoalAdvancedScreenContent() {
  const { D, F } = useTaskPresentation();

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

  return (<TaskPage title="Fine-tune the calculation" section="Advanced goals" subtitle="These edits stay in your goal draft. Save from Goal setup when you are ready." onBack={() => router.back()}>

    <ProfileIntro label="Draft calculation" title="Control the assumptions" detail="These are calculator estimates. Returning keeps your draft; only Goal setup saves it." />
    <ProfileStats values={[{label: "Draft energy", value: `${result.dailyCalories.toLocaleString()} kcal`}, {label: "Maintenance estimate", value: `${Math.round(result.tdee).toLocaleString()} kcal`}]} />
    <ProfileSection index="01" title="Energy model">
    <View style={{ gap: 8 }}>
      {[['mifflin', 'Mifflin-St Jeor'], ['harris_benedict', 'Revised Harris-Benedict'], ['katch_mcardle', 'Katch-McArdle']].map(([key, label]) => <Choice key={key} label={label} selected={draft.bmrFormula === key} onPress={() => updateDraft({ bmrFormula: key as GoalInputs['bmrFormula'] })} />)}
    </View>
    {draft.bmrFormula === 'katch_mcardle' && <Text style={F.caption}>Uses body fat when set; otherwise falls back to Mifflin-St Jeor.</Text>}

    </ProfileSection><ProfileSection index="02" title="Maintenance override">
      <TaskToggle title="Use my maintenance calories" detail="Overrides the activity multiplier calculation" value={draft.manualTDEEOverride != null} onChange={value => updateDraft({ manualTDEEOverride: value ? result.tdee : null })} />
      {draft.manualTDEEOverride != null && <Field label="Maintenance · kcal" keyboardType="number-pad" value={String(Math.round(draft.manualTDEEOverride))} onChangeText={v => updateDraft({ manualTDEEOverride: v ? Number(v) : null })} />}
    </ProfileSection>

    <ProfileSection index="03" title="Body composition" detail="Optional input for the calculation."><Field label="Body fat · % · optional" value={bodyFatInput} keyboardType="decimal-pad" onChangeText={value => { setBodyFatInput(value); const parsed = Number(value); updateDraft({ bodyFatPercent: value === '' || Number.isNaN(parsed) ? null : parsed }); }} />
    {draft.bodyFatPercent != null && (draft.bodyFatPercent < 3 || draft.bodyFatPercent > 50) && <Text style={F.caption}>Body fat must be between 3% and 50%.</Text>}
    {leanMass != null && <Text style={F.body}>Calculated lean mass · {leanMass.toFixed(1)} kg</Text>}

    </ProfileSection><ProfileSection index="04" title="Macro distribution">
      <TaskToggle title="Set my macro split" value={draft.manualMacroRatios != null} onChange={value => updateDraft({ manualMacroRatios: value ? { protein: 35, carbs: 40, fat: 25 } : null })} />
      {draft.manualMacroRatios && <>{(['protein', 'carbs', 'fat'] as const).map(key => {
        const ratios = draft.manualMacroRatios!; return <View key={key} style={{ gap: 8 }}>
          <Heading title={key} detail={`${ratios[key]}%`} />
          <Slider accessibilityLabel={`${key} percentage`} minimumValue={10} maximumValue={70} step={1} minimumTrackTintColor={D.teal} maximumTrackTintColor={D.raised} thumbTintColor={D.lime} value={ratios[key]} onValueChange={(value: number) => updateDraft({ manualMacroRatios: rebalanceRatios(ratios, key, value) })} />
        </View>;
      })}<Text style={F.body}>{result.protein} g protein · {result.carbs} g carbs · {result.fat} g fat</Text>{proteinPctWarning && <Text style={F.caption}>Low protein may reduce muscle retention.</Text>}</>}
    </ProfileSection>
    <Button label="Reset advanced settings" onPress={() => updateDraft({ manualTDEEOverride: null, bodyFatPercent: null, manualMacroRatios: null })} />
  </TaskPage>
  );
}

export default function GoalAdvancedScreen() {
  return <SomataTaskAppearance><GoalAdvancedScreenContent /></SomataTaskAppearance>;
}
