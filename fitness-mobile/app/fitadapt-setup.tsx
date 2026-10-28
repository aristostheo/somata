import { ProfileIntro, ProfileSection, ProfileFields } from "@/components/profile/ProfileTaskUI";
import { visualTokens } from "@/components/accountSettings/visualTokens";
import { Button, Choice, Empty, Field, Heading, Item, Metric, Panel, TaskPage } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { auth } from "@/lib/firebase";
import { getFitAdaptPlan, requestFitAdaptEvaluation, type FitAdaptPlanState } from "@/services/fitadapt";
import { clearFitAdaptSetupMarker, fitAdaptSetupPendingFor } from "@/services/fitadaptOnboarding";
import { createSetupRunner, draftFromProfile, missingFitAdaptInputs, savedPaceForDraft, validateSetup, type SetupDraft } from "@/services/fitadaptSetup";
import { ensureProfile, subscribeProfile, updateProfile, type Profile } from "@/services/profile";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

const draftKey = (uid: string) => `@somata:fitadapt-setup-draft:v1:${uid}`;
const activityOptions = [
  ["sedentary", "Mostly seated"], ["light", "Light"], ["moderate", "Moderate"],
  ["active", "Active"], ["very_active", "Very active"], ["extra_active", "Extra active"],
] as const;
const goalOptions = [["cut", "Lose weight"], ["maintain", "Maintain"], ["lean_bulk", "Lean gain"], ["bulk", "Gain"]] as const;
const paceOptions = [["gentle", "Gentle"], ["moderate", "Moderate"], ["aggressive", "Faster"]] as const;
const strategyOptions = [["standard", "Balanced"], ["high", "Higher protein"], ["very_high", "Very high protein"]] as const;

function FitAdaptSetupContent() {
  const { D, F } = useTaskPresentation();

  const { user } = useAuth();
  const router = useRouter();
  const { isDark, themeAccents } = useTheme();
  const palette = useMemo(() => visualTokens(isDark,
    (isDark ? themeAccents.dark.primary : themeAccents.light.primary) ?? "#315B9A",
    (isDark ? themeAccents.dark.accent : themeAccents.light.accent) ?? "#17786C"), [isDark, themeAccents]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [kind, setKind] = useState<"new" | "existing">("existing");
  const [kindLoaded, setKindLoaded] = useState(false);
  const [kindError, setKindError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<FitAdaptPlanState | null>(null);
  const [step, setStep] = useState<"form" | "confirm" | "result">("form");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);
  const draftRef = useRef<SetupDraft | null>(null);
  const draftWriteRef = useRef<Promise<void>>(Promise.resolve());
  const initializedRef = useRef(false);
  const runner = useMemo(() => createSetupRunner({
    getPlan: getFitAdaptPlan,
    save: async (patch) => {
      if (!user?.uid) throw new Error("Sign in to save your setup.");
      await ensureProfile(user.uid);
      await updateProfile(user.uid, patch);
      savedRef.current = true;
      setSaved(true);
    },
    evaluate: requestFitAdaptEvaluation,
  }), [user?.uid]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    let active = true;
    initializedRef.current = false;
    draftRef.current = null;
    setKindLoaded(false);
    setKindError(false);
    void fitAdaptSetupPendingFor(user).then((pending) => {
      if (active) { setKind(pending ? "new" : "existing"); setKindLoaded(true); }
    }).catch(() => { if (active) { setKindError(true); setKindLoaded(true); } });
    void getFitAdaptPlan().then((state) => { if (active) setPlan(state); })
      .catch((error) => { if (active) setNotice(error instanceof Error ? error.message : "Could not load your plan."); });
    const unsubscribe = subscribeProfile(uid, (value) => {
      if (!active) return;
      setProfile(value);
      if (!initializedRef.current && missingFitAdaptInputs(value).length === 0) {
        savedRef.current = true;
        setSaved(true);
      }
      if (!initializedRef.current) {
        initializedRef.current = true;
        void AsyncStorage.getItem(draftKey(uid)).then((stored) => {
          if (!active) return;
          let initial = draftFromProfile(value);
          if (stored) {
            try {
              const parsed: unknown = JSON.parse(stored);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
                initial = { ...initial, ...parsed };
            } catch { }
          }
          draftRef.current = initial;
          setDraft(initial);
          setLoaded(true);
        });
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [user?.uid]);

  const missing = useMemo(() => missingFitAdaptInputs(profile), [profile]);
  const savedPace = draft && kind === "existing" ? savedPaceForDraft(profile, draft) : undefined;
  const checked = draft ? validateSetup(draft, savedPace, kind === "existing" ? profile : null) : null;
  const weeklyPace = checked && "values" in checked ? checked.values.weeklyPaceKg : null;
  const paceSummary = weeklyPace == null ? "Choose the required details to see your weekly change" :
    `${weeklyPace > 0 ? "+" : ""}${weeklyPace.toFixed(2)} kg/week`;
  const needs = (field: string) => kind === "new" && !saved ? true :
    field === "pace" && savedPace !== undefined ? false : missing.includes(field);
  const update = (patch: Partial<SetupDraft>) => {
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    draftRef.current = next;
    setDraft(next);
    if (user?.uid) draftWriteRef.current = draftWriteRef.current.catch(() => { }).then(
      () => AsyncStorage.setItem(draftKey(user.uid), JSON.stringify(next)));
  };
  const changeUnit = (weightUnit: SetupDraft["weightUnit"]) => {
    if (!draft || weightUnit === draft.weightUnit) return;
    const currentWeight = Number(draft.weight);
    const weightKg = Number.isFinite(currentWeight) && draft.weight
      ? currentWeight * (draft.weightUnit === "lb" ? 0.45359237 : 1) : NaN;
    const heightCm = draft.weightUnit === "lb"
      ? (Number(draft.heightFeet) * 12 + Number(draft.heightInches)) * 2.54
      : Number(draft.heightCm);
    const totalInches = Math.round(heightCm / 2.54);
    update({
      weightUnit,
      weight: Number.isFinite(weightKg) ? String(Number((weightUnit === "lb" ? weightKg / 0.45359237 : weightKg).toFixed(1))) : "",
      heightCm: Number.isFinite(heightCm) && heightCm > 0 ? String(Number(heightCm.toFixed(1))) : "",
      heightFeet: Number.isFinite(totalInches) && totalInches > 0 ? String(Math.floor(totalInches / 12)) : "",
      heightInches: Number.isFinite(totalInches) && totalInches > 0 ? String(totalInches % 12) : "",
    });
  };
  const finish = async () => {
    await draftWriteRef.current.catch(() => { });
    if (user?.uid) await AsyncStorage.removeItem(draftKey(user.uid));
    await clearFitAdaptSetupMarker();
    router.replace("/(tabs)/profile");
  };
  const submit = async () => {
    if (!draft || !user?.uid || busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice("");
    try {
      const result = await runner(profile, draft, kind === "new" && missing.length ? "new" : "existing");
      if (result.kind === "active" || result.kind === "pending") { await finish(); return; }
      if (result.result.kind === "insufficient_data") {
        setNotice(`Your profile and goals are saved. FitAdapt still needs: ${result.result.missing.map((part) => part.split(".").slice(-1)[0]).join(", ")}. You can continue and review later.`);
        setStep("result");
      } else if (result.result.state.pending) {
        await finish();
      } else {
        setNotice(result.result.evaluation.integration_status.more_data_needed
          ? "Your profile and goals are saved. More dated weight and nutrition records are needed before a change can be proposed."
          : "Your profile and goals are saved. FitAdapt has no change ready for review yet.");
        setStep("result");
      }
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : "Review failed."} ${savedRef.current ? "Your saved profile is intact. Retry the review or continue to the app." : "Your entries are still here. Try saving again."}`);
      setStep(savedRef.current ? "result" : "confirm");
    } finally { busyRef.current = false; setBusy(false); }
  };

  const text = palette.text;
  const secondary = palette.secondary;
  const card = { backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1 as const, borderRadius: 20, padding: 18, gap: 14 as const };
  const inputStyle = { color: text, borderColor: palette.border, borderWidth: 1 as const, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, fontSize: 16, backgroundColor: palette.raised };
  const button = (label: string, onPress: () => void, primary = false, disabled = false) =>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 48, borderRadius: 13, paddingHorizontal: 16, justifyContent: "center", alignItems: "center", backgroundColor: primary ? palette.primary : palette.raised, opacity: disabled ? 0.5 : 1 }}>

      <Text style={{ color: primary ? "#FFFFFF" : text, fontWeight: "700", fontSize: 15 }}>{label}</Text>

    </Pressable>;
  const field = (label: string, value: string, onChange: (value: string) => void, placeholder: string) => <Field label={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={placeholder} />;
  const chips = <T extends string,>(label: string, value: T, options: readonly (readonly [T, string])[], onChange: (value: T) => void) => <View style={{ gap: 10 }}>
    <Text style={F.caption}>{label}</Text>
    <View style={F.wrap}>
      {options.map(([option, title]) => <Choice key={option} label={title} selected={value === option} onPress={() => onChange(option)} />)}
    </View>
  </View>;

  if (!user || !loaded || !kindLoaded || !draft) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: D.bg }}>
    <ActivityIndicator color={D.teal} />
  </View>;
  if (kindError) return <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: D.bg }}>

    <Text accessibilityRole="alert" style={{ color: text, fontSize: 17 }}>Could not read your saved setup status. Your account and goals are unchanged.</Text>

    <Button primary label="Return to Profile" onPress={() => router.replace("/(tabs)/profile")} />

  </View>;
  return (<TaskPage title={kind === 'new' ? 'Your starting point' : 'Complete your profile'} section="FitAdapt setup" onBack={() => router.replace('/(tabs)/profile')} subtitle="Your information helps estimate energy needs. You choose whether to accept a plan.">
    <ProfileIntro fitadapt label="FitAdapt / setup" title={step === "form" ? "Start with your information" : step === "confirm" ? "Review before requesting" : "Your next step"} detail="A review proposes targets. You always decide whether to accept them." />
    <Panel><View style={F.wrap}>
      {['Details', 'Review', 'Next step'].map((label, i) => <Text key={label} style={{ ...F.eyebrow, color: (step === 'form' ? 0 : step === 'confirm' ? 1 : 2) === i ? D.lime : D.muted }}>{i + 1} / {label}</Text>)}
    </View></Panel>
    <Panel>
      <Heading title="Personal, for a reason" />
      <Text style={F.body}>Age, measurements, equation sex and activity are used by the energy equation. Unsaved answers stay on this device. On submission, Somata saves your profile and shares only the required fitness fields with FitAdapt.</Text>
    </Panel>
    {plan?.currentRecommendation ? <Panel accent>
      <Heading title="An accepted plan is saved" detail="Setup will not change targets or request another recommendation." />
      <Button primary label="Go to Profile" onPress={() => void finish()} />
    </Panel> : plan?.pending ? <Panel accent>
      <Heading title="Pending review" detail="Your current targets stay in place until you accept the proposal." />
      <Button primary label="Review in Profile" onPress={() => void finish()} />
    </Panel> : <>
      {step === 'form' && <>
        {missing.length === 0 && kind === 'existing' ? <Empty title="Ready for a review" detail="Your saved profile has the required inputs. No goals will be changed by requesting a review." /> : <>
          <ProfileSection index="01" title="Measurements" detail="Use the units you're comfortable with.">
          {(needs('heightCm') || needs('weightKg')) && chips('Units', draft.weightUnit, [['kg', 'kg / cm'], ['lb', 'lb / ft-in']] as const, changeUnit)}
          <ProfileFields>
            {needs('age') && field('Age (years)', draft.age, age => update({ age }), '18–80')}
            {needs('weightKg') && field(`Weight (${draft.weightUnit})`, draft.weight, weight => update({ weight }), 'Current weight')}
          </ProfileFields>
          {needs('heightCm') && (draft.weightUnit === 'kg' ? field('Height (cm)', draft.heightCm, heightCm => update({ heightCm }), 'Height') : <ProfileFields>
            {field('Height (ft)', draft.heightFeet, heightFeet => update({ heightFeet }), 'Feet')}
            {field('Inches', draft.heightInches, heightInches => update({ heightInches }), 'Inches')}
          </ProfileFields>)}
          {needs('sex') && chips('Equation sex', draft.sex, [['female', 'Female'], ['male', 'Male']] as const, sex => update({ sex }))}
          </ProfileSection><ProfileSection index="02" title="Your direction">
          {needs('activityLevel') && chips('Activity level', draft.activityLevel, activityOptions, activityLevel => update({ activityLevel }))}
          {needs('mode') && chips('Goal', draft.mode, goalOptions, mode => update({ mode, pace: mode === 'maintain' ? 'moderate' : '' }))}
          {needs('pace') && draft.mode !== 'maintain' && chips('Weekly pace', draft.pace, paceOptions, pace => update({ pace }))}
          {(needs('pace') || kind === 'new') && <Text style={F.body}>Requested weekly change · {paceSummary}</Text>}
          {needs('proteinPriority') && chips('Macro strategy', draft.proteinPriority, strategyOptions, proteinPriority => update({ proteinPriority }))}</ProfileSection>
        </>}
        <Button label="Review details" primary onPress={() => { if (checked && 'errors' in checked && missing.length) setNotice(checked.errors.join(' ')); else { setNotice(''); setStep('confirm'); } }} />
        {kind === 'new' ? <Button label="Sign out and finish later" onPress={() => void (async () => { await draftWriteRef.current.catch(() => { }); await signOut(auth); })()} /> : <Button label="Back to Profile" onPress={() => router.replace('/(tabs)/profile')} />}
      </>}
      {step === 'confirm' && <><ProfileSection index="03" title="Review your details" detail="Saved profile inputs • no plan accepted here"><View style={F.wrap}>
        <Metric label="Age" value={draft.age} />
        <Metric label="Weight" value={`${draft.weight} ${draft.weightUnit}`} />
      </View><Panel>
          <Item title="Height" value={draft.weightUnit === 'kg' ? `${draft.heightCm} cm` : `${draft.heightFeet} ft ${draft.heightInches} in`} />
          <Item title="Equation sex" value={draft.sex} />
          <Item title="Activity" value={draft.activityLevel.replaceAll('_', ' ')} />
          <Item title="Goal" value={draft.mode.replaceAll('_', ' ')} />
          <Item title="Weekly change" value={paceSummary} />
          <Item title="Macro strategy" value={draft.proteinPriority.replaceAll('_', ' ')} />
        </Panel></ProfileSection><Text style={F.body}>Your current targets remain active until you explicitly accept a valid proposal.</Text><Button label={busy ? 'Working…' : saved ? 'Retry review' : 'Save and request review'} primary disabled={busy} onPress={() => void submit()} /><Button label="Edit details" disabled={busy} onPress={() => setStep('form')} /></>}
      {step === 'result' && <Panel accent>
        <Heading title="Your goals are saved" />
        <Button label={busy ? 'Working…' : 'Retry FitAdapt review'} primary disabled={busy} onPress={() => void submit()} />
        <Button label="Continue to Profile" disabled={busy} onPress={() => void finish()} />
      </Panel>}
    </>}
    {!!notice && <Text accessibilityRole="alert" style={F.body}>{notice}</Text>}
  </TaskPage>
  );
}

export default function FitAdaptSetup() {
  return <SomataTaskAppearance><FitAdaptSetupContent /></SomataTaskAppearance>;
}
