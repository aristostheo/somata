import { useTaskPresentation } from "@/components/designPreview/Appearance";
import { Ionicons } from "@expo/vector-icons";
import type { DayData } from "@/services/calendarData";
import { Text, View } from "react-native";
import { Empty, Heading, Item, Metric, Panel } from "./TaskUI";
const number = (value: number) => Math.round(value).toLocaleString();
export function CalendarRecord({ day }: { day: DayData | null; }) {
  const { D, F, premium } = useTaskPresentation();

  if (premium) return <PremiumRecord day={day} />;
  if (!day) return <Empty title="No record for this day" detail="Saved activity and nutrition will appear here." />;
  return <>
    <View style={F.wrap}>
      <Metric label="Day score" value={String(day.overallScore)} detail="Existing logging score" />

      {day.steps && <Metric label="Steps" value={number(day.steps.count)} detail={`${number(day.steps.goal)} daily goal`} />}

      {day.hydration && <Metric label="Water" value={`${number(day.hydration.logged)} ml`} detail={`${number(day.hydration.goal)} goal`} />}
    </View>
    <Panel>
      <Heading title="Nutrition record" detail={day.nutrition ? `${number(day.nutrition.calories)} / ${number(day.nutrition.calorieGoal)} kcal` : "Nothing logged"} />

      {!!day.nutrition && <><View style={F.wrap}>
        {([['Protein', 'protein', 'proteinGoal'], ['Carbs', 'carbs', 'carbsGoal'], ['Fat', 'fat', 'fatGoal']] as const).map(([label, key, goal]) =>
          <View key={key} style={{ flex: 1, minWidth: 90, gap: 6 }}>
            <Text style={F.caption}>{label}</Text>
            <Text style={{ ...F.heading, color: D.lime }}>{number(day.nutrition![key])} g</Text>
            <Text style={F.caption}>{number(day.nutrition![goal])} g goal</Text>
          </View>)}
      </View>
        <View>
          {day.nutrition.meals.map((meal, i) => <Item key={i} title={meal.name} detail={meal.time} value={`${number(meal.calories)} kcal`} />)}
        </View></>}

    </Panel>
    <View style={{ gap: 12 }}>
      <Heading title="Training record" />
      {day.workout ? <Panel>
        <Heading title={day.workout.name} detail={`${day.workout.duration} min · ${day.workout.exercises} exercises`} />

        <Text style={F.body}>{number(day.workout.volume)} kg volume · Score {day.workout.score}</Text>
        {!!day.workout.fatigue && <Text style={F.caption}>{day.workout.fatigue}</Text>}
      </Panel> : <Text style={F.body}>No workout logged.</Text>}
    </View>
    {day.sleep && <Panel>
      <Heading title="Recorded sleep" detail={`${Math.floor(day.sleep.duration / 60)}h ${day.sleep.duration % 60}m · Score ${day.sleep.score}`} />

      <Text style={F.body}>Deep {day.sleep.deep}m · REM {day.sleep.rem}m · Light {day.sleep.light}m</Text>
    </Panel>}
    {typeof day.weight === 'number' && <Item title="Body measurement" value={`${number(day.weight)} lb`} detail="From the existing body history record" />}
    {!!day.prs?.length && <Panel accent>
      <Heading title="Personal records" />
      {day.prs.map((pr, i) => <Item key={i} title={pr.exercise} value={`${number(pr.weight)} kg · ${pr.reps} reps`} />)}
    </Panel>}
  </>;
}

function PremiumRecord({ day }: { day: DayData | null }) {
  const { F, t } = useTaskPresentation();
  if (!day) return <Empty title="No record for this day" detail="Saved activity and nutrition will appear here." />;
  return <>
    <Panel accent>
      <View style={{ ...F.row, alignItems: "flex-start" }}>
        <View style={{ gap: 8, flex: 1 }}>
          <Text style={F.eyebrow}>NUTRITION RECORD</Text>
          {day.nutrition ? <>
            <Text style={{ ...F.value, fontSize: 34 }}>{number(day.nutrition.calories)} <Text style={F.body}>kcal</Text></Text>
            <Text style={F.caption}>/ {number(day.nutrition.calorieGoal)} kcal goal</Text>
          </> : <Text style={F.heading}>Nothing logged</Text>}
        </View>
        <View style={{ backgroundColor: t.selection.background, padding: 12, borderRadius: 15 }}>
          <Ionicons name="flame-outline" color={t.action.link} size={26} />
        </View>
      </View>
      {!!day.nutrition && <>
        <View style={F.wrap}>
          {([['Protein', 'protein', 'proteinGoal'], ['Carbs', 'carbs', 'carbsGoal'], ['Fat', 'fat', 'fatGoal']] as const).map(([label, key, goal]) =>
            <Metric key={key} label={label} value={`${number(day.nutrition![key])} g`} detail={`${number(day.nutrition![goal])} g goal`} />)}
        </View>
        <View>
          {day.nutrition.meals.map((meal, i) => <Item key={i} title={meal.name} detail={meal.time} value={`${number(meal.calories)} kcal`} />)}
        </View>
      </>}
    </Panel>
    <Panel>
      <View style={{ ...F.row, justifyContent: 'flex-start' }}>
        <Ionicons name="barbell-outline" size={24} color={t.action.link} />
        <Heading title="Training record" />
      </View>
      {day.workout ? <>
        <Text style={F.heading}>{day.workout.name}</Text>
        <View style={F.wrap}>
          <Metric label="Duration" value={`${day.workout.duration} min`} />
          <Metric label="Exercises" value={String(day.workout.exercises)} />
          <Metric label="Volume" value={`${number(day.workout.volume)} kg`} />
        </View>
        <Text style={F.caption}>Score {day.workout.score}{day.workout.fatigue ? ` · ${day.workout.fatigue}` : ''}</Text>
      </> : <Text style={F.body}>No workout logged.</Text>}
    </Panel>
    <Heading title="More recorded detail" />
    <View style={F.wrap}>
      <Metric label="Day score" value={String(day.overallScore)} detail="Existing logging score" />
      {day.steps && <Metric label="Steps" value={number(day.steps.count)} detail={`${number(day.steps.goal)} daily goal`} />}
      {day.hydration && <Metric label="Water" value={`${number(day.hydration.logged)} ml`} detail={`${number(day.hydration.goal)} goal`} />}
    </View>
    {day.sleep && <Panel>
      <Heading title="Recorded sleep" detail={`${Math.floor(day.sleep.duration / 60)}h ${day.sleep.duration % 60}m · Score ${day.sleep.score}`} />
      <Text style={F.body}>Deep {day.sleep.deep}m · REM {day.sleep.rem}m · Light {day.sleep.light}m</Text>
    </Panel>}
    {typeof day.weight === 'number' && <Item icon="scale-outline" title="Body measurement" value={`${number(day.weight)} lb`} detail="From the existing body history record" />}
    {!!day.prs?.length && <Panel accent>
      <Heading title="Personal records" />
      {day.prs.map((pr, i) => <Item key={i} icon="trophy-outline" title={pr.exercise} value={`${number(pr.weight)} kg · ${pr.reps} reps`} />)}
    </Panel>}
  </>;
}
