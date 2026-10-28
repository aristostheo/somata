import { ProfileIntro, ProfileSection } from "@/components/profile/ProfileTaskUI";
import { ChoiceRail, FlowNotice, FlowPage, SmallStat } from "@/components/homeFlows/FlowUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, type Profile } from "@/services/profile";
import { recordedStepDays } from "@/services/profile/fitadaptInsightData";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";

type RangeKey = 7 | 30 | 90;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDayLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtWeekday(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function rangeSubtitle(range: RangeKey, dates: string[]) {
  if (!dates.length) return "";
  const first = fmtDayLabel(dates[0]);
  const last = fmtDayLabel(dates[dates.length - 1]);
  if (range === 7) return `Week of ${first}-${last}`;
  if (range === 30) return `Month of ${first}-${last}`;
  const startMonth = new Date(`${dates[0]}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
  });
  const endMonth = new Date(`${dates[dates.length - 1]}T12:00:00`).toLocaleDateString(
    undefined,
    { month: "short" }
  );
  return `Last 90 days · ${startMonth}-${endMonth}`;
}

function StepsHistoryScreenContent() {
  const { D, F, t } = useTaskPresentation();

  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [ownedProfile, setOwnedProfile] = useState<{ uid: string; value: Profile | null; } | null>(null);
  const [range, setRange] = useState<RangeKey>(30);
  useEffect(() => {
    if (!user?.uid) return;
    const owner = user.uid;
    return subscribeProfile(owner, (value) => setOwnedProfile({ uid: owner, value }));
  }, [user?.uid]);
  const profile = ownedProfile?.uid === user?.uid ? ownedProfile?.value : undefined;
  const stepsMap = (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
  const stepsGoal = Number((profile as any)?.stepsGoal ?? (profile as any)?.stepsPerDay ?? 8000);
  const today = new Date();
  const dates = useMemo(
    () => Array.from({ length: range }, (_, i) => ymd(addDays(today, -(range - 1) + i))),
    [range]
  );
  const rows = useMemo(
    () =>
      dates.map((date) => ({
        date,
        steps: Number(stepsMap[date] || 0),
      })),
    [dates, stepsMap]
  );

  const total = rows.reduce((sum, row) => sum + row.steps, 0);
  const avg = rows.length ? Math.round(total / rows.length) : 0;
  const best = rows.reduce((max, row) => (row.steps > max.steps ? row : max), {
    date: dates[0] || ymd(today),
    steps: 0,
  });
  const goalHits = rows.filter((row) => row.steps >= stepsGoal).length;
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].steps <= 0) break;
      streak += 1;
    }
    return streak;
  }, [rows]);

  const chartMax = Math.max(stepsGoal, best.steps, 1000);

  const recordedDates = new Set(recordedStepDays(stepsMap, dates[0], dates[dates.length - 1]).map((day) => day.date));
  const recorded = (date: string) => recordedDates.has(date);
  const hasRecords = rows.some((row) => recorded(row.date));
  const savedGoal = profile?.stepsGoal != null || (profile as any)?.stepsPerDay != null;
  const chartWidth = Math.max(width - 80, rows.length * 13);
  const unavailable = !user?.uid || profile === null;

  return <FlowPage title="Every recorded step." eyebrow="Movement / steps history" onBack={() => router.back()}>

    <ProfileIntro label="Account / dated steps" title="Movement, day by day" detail="Your saved step records. Missing dates stay distinct from recorded zero." />
    <ChoiceRail label="Step history period" value={range} onChange={setRange}
      choices={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }]} />

    {unavailable ? <FlowNotice title="Step history unavailable" detail={user?.uid ?
      "Your saved profile could not be loaded right now." : "Sign in to view steps saved to your account."} error /> :
      profile === undefined ? <FlowNotice title="Loading your steps…" /> : <>
        <ProfileSection index="01" title="Period total">

          <Text style={F.eyebrow}>STEPS IN THIS PERIOD</Text>

          <Text style={{ ...F.value, fontSize: 54, letterSpacing: -2 }}>{hasRecords ? total.toLocaleString() : "—"}</Text>

          <Text style={F.body}>{rangeSubtitle(range, dates)}</Text>

        </ProfileSection>
        <ProfileSection index="02" title="Dated movement">

          <View style={{ ...F.row, flexWrap: "wrap" }}>

            <Text accessibilityRole="header" style={F.heading}>Your rhythm</Text>

            <Text style={F.caption}>{savedGoal ? "Daily goal" : "Default daily goal"} · {stepsGoal.toLocaleString()}</Text>

          </View>

          {hasRecords ? <>
            <ScrollView horizontal showsHorizontalScrollIndicator={range > 7}
              accessibilityLabel="Dated step counts; swipe horizontally for the full period">

              <View style={{ width: chartWidth, height: 162, flexDirection: "row", alignItems: "flex-end", gap: 4 }}>

                {rows.map((row) => <View key={row.date} accessible
                  accessibilityLabel={`${fmtDayLabel(row.date)}: ${recorded(row.date) ? `${row.steps} steps` : "No record"}`}
                  style={{ flex: 1, height: 162, justifyContent: "flex-end", alignItems: "center", gap: 8 }}>

                  <View style={{ height: 132, width: "100%", justifyContent: "flex-end" }}>

                    {recorded(row.date) && row.steps > 0 && <View style={{
                      height: Math.max(2, row.steps / chartMax * 132),
                      borderRadius: 6, backgroundColor: row.steps >= stepsGoal ? t.status.success : D.teal
                    }} />}

                    {recorded(row.date) && row.steps === 0 && <View style={{ height: 2, backgroundColor: D.teal }} />}

                  </View>

                  <Text style={{ color: D.muted, fontSize: 10 }}>{range === 7 ? fmtWeekday(row.date).slice(0, 1) : "·"}</Text>

                </View>)}

              </View>

            </ScrollView>
            <View style={F.row}>

              <Text style={F.caption}>{fmtDayLabel(dates[0])}</Text>

              <Text style={F.caption}>{fmtDayLabel(dates[dates.length - 1])}</Text>

            </View>
          </> : <Text style={F.body}>No dated step records in this period. Saved steps will appear here.</Text>}

          <View style={F.wrap}>

            <Text style={{ ...F.caption, color: D.teal }}>● Recorded steps</Text>

            <Text style={{ ...F.caption, color: t.status.success }}>● Goal reached</Text>

          </View>

        </ProfileSection>
        <View style={F.wrap}>

          <SmallStat label="Daily average" value={hasRecords ? avg.toLocaleString() : "—"} detail={`Across all ${range} days`} />

          <SmallStat label="Best day" value={hasRecords ? best.steps.toLocaleString() : "—"}
            detail={hasRecords && best.steps > 0 ? fmtDayLabel(best.date) : undefined} />

          <SmallStat label="Days at goal" value={hasRecords ? `${goalHits} / ${range}` : "—"} />

          <SmallStat label="Current movement streak" value={hasRecords ? `${currentStreak} days` : "—"} detail="Days with steps, ending today" />

        </View>
        <Text style={F.caption}>Daily average uses the whole selected period, including days without a log. Blank chart positions mean no record.</Text>
        <View style={{ gap: 8 }}>

          <Text accessibilityRole="header" style={F.heading}>Daily ledger</Text>

          <Text style={F.caption}>Most recent {Math.min(range, 20)} days · saved account records</Text>

        </View>
        <View style={{ gap: 18 }}>

          {rows.slice().reverse().slice(0, 20).map((row) => {
            const known = recorded(row.date);
            const hit = known && row.steps >= stepsGoal;
            const fraction = known && stepsGoal > 0 ? Math.max(0, Math.min(1, row.steps / stepsGoal)) : 0;
            return <View key={row.date} accessibilityLabel={fmtDayLabel(row.date)} style={{
              flexDirection: "row", gap: 13, padding: 16, borderRadius: 18,
              backgroundColor: t.surface.primary, borderWidth: 1, borderColor: t.border.subtle
            }}>

              <View style={{ width: 44, alignItems: "center", gap: 4 }}>

                <Text style={{ ...F.caption, fontSize: 10 }}>{fmtWeekday(row.date).toUpperCase()}</Text>

                <Text style={{ color: D.text, fontWeight: "800", fontSize: 22 }}>{new Date(`${row.date}T12:00:00`).getDate()}</Text>

              </View>

              <View style={{ flex: 1, gap: 8 }}>

                <View style={{ ...F.row, flexWrap: "wrap", gap: 4 }}>

                  <Text style={{ color: D.text, fontSize: 19, fontWeight: "700" }}>{known ? row.steps.toLocaleString() : "—"}</Text>

                  <Text style={{ ...F.caption, color: hit ? t.status.success : D.muted }}>{!known ? "No record" : hit ? "Goal reached" :
                    row.steps > 0 ? `${Math.max(0, stepsGoal - row.steps).toLocaleString()} to goal` : "0 steps recorded"}</Text>

                </View>

                <View style={{ height: 5, borderRadius: 3, backgroundColor: D.raised }}>

                  {known && <View style={{ height: 5, borderRadius: 3, width: `${fraction * 100}%`, backgroundColor: hit ? t.status.success : D.teal }} />}

                </View>

              </View>

            </View>;
          })}

        </View>
      </>}

  </FlowPage>;
}

export default function StepsHistoryScreen() {
  return <SomataTaskAppearance><StepsHistoryScreenContent /></SomataTaskAppearance>;
}
