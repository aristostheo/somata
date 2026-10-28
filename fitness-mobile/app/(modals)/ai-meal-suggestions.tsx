import { NutritionContext, NutritionValues } from "@/components/nutrition/NutritionTaskUI";
import { Button, Empty, Field, Heading, Panel, TaskPage } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
// app/(modals)/ai-meal-suggestions.tsx
import { useTheme } from "@/content/ThemeProvider";
import { releaseConfig } from "@/lib/releaseConfig";
import { useEntitlements } from "@/content/useEntitlements";
import { callOpenAIJson } from "@/services/openai";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Text
} from "react-native";

// ---- Types ----
type MealIdea = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  meal?: "breakfast" | "lunch" | "dinner" | "snacks";
  prep_min?: number;
  difficulty?: "easy" | "moderate" | "advanced";
  notes?: string;
};
type MealIdeasResponse = { meals: MealIdea[]; rationale?: string; };

export default function AiMealSuggestions() {
  return <SomataTaskAppearance><AiMealSuggestionsContent /></SomataTaskAppearance>;
}

function AiMealSuggestionsContent() {
  const { D, F } = useTaskPresentation();

  const { colors, isDark } = useTheme() as any;
  const router = useRouter();
  const { isPro } = useEntitlements();
  const [showingLock, setShowingLock] = useState(false);

  const ensurePro = () => {
    if (isPro) return true;
    if (!releaseConfig.checkoutEnabled) {
      Alert.alert("Pro access required", "This tool requires Pro access. Purchases are unavailable in this build.");
      return false;
    }
    if (showingLock) return false;
    setShowingLock(true);
    Alert.alert(
      "Pro required",
      "AI meal ideas are part of Pro. Unlock to continue.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => setShowingLock(false),
        },
        {
          text: "See Pro",
          onPress: () => {
            setShowingLock(false);
            router.replace("/paywall");
          },
        },
      ],
    );
    return false;
  };

  // Expect these from the nutrition tab when navigating here.
  // If you can pass them, send JSON.stringified objects for goals & totals.
  const {
    date,
    meal,
    focus,
    goals: goalsStr,
    totals: totalsStr,
  } = useLocalSearchParams<{
    date?: string;
    meal?: string;
    focus?: string;
    goals?: string; // JSON string e.g. {"calories":2400,"protein":180,"carbs":260,"fat":70}
    totals?: string; // JSON string e.g. {"calories":1200,"protein":78,"carbs":105,"fat":55}
  }>();

  const goals = useMemo(() => {
    try {
      return goalsStr ? JSON.parse(goalsStr) : undefined;
    } catch {
      return undefined;
    }
  }, [goalsStr]);

  const totals = useMemo(() => {
    try {
      return totalsStr ? JSON.parse(totalsStr) : undefined;
    } catch {
      return undefined;
    }
  }, [totalsStr]);

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<MealIdea[]>([]);

  const headerGrad = useMemo<readonly [string, string]>(
    () => (isDark ? ["#3b82f6", "#60a5fa"] : ["#22c55e", "#16a34a"]),
    [isDark],
  );

  async function fetchIdeas(opts: { forceNew?: boolean; }) {
    if (!ensurePro()) return;
    // sensible fallbacks if the screen was opened without params
    const safeGoals =
      goals && typeof goals === "object"
        ? goals
        : { calories: 2400, protein: 160, carbs: 240, fat: 70 };

    const safeTotals =
      totals && typeof totals === "object"
        ? totals
        : { calories: 0, protein: 0, carbs: 0, fat: 0 };

    try {
      setLoading(true);

      const data: MealIdeasResponse = await callOpenAIJson<MealIdeasResponse>(
        [
          {
            role: "system",
            content:
              "You generate Somata meal ideas. Return valid JSON only and keep suggestions practical.",
          },
          {
            role: "user",
            content: `Generate 5 meal ideas as JSON only.
Meal target: ${(meal as any) || "any"}
Goals: ${JSON.stringify(safeGoals)}
Totals so far: ${JSON.stringify(safeTotals)}
Notes: ${(notes || "").trim().slice(0, 200) || "none"}

Return:
{
  "meals": [
    {
      "name": string,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "sugar": number | null,
      "fiber": number | null,
      "meal": "breakfast" | "lunch" | "dinner" | "snacks",
      "prep_min": number | null,
      "difficulty": "easy" | "moderate" | "advanced",
      "notes": string | null
    }
  ],
  "rationale": string
}`,
          },
        ],
        { operation: "mealIdeas", maxTokens: 1400, temperature: 0.55 }
      );

      const meals = Array.isArray((data as any)?.meals)
        ? (data as any).meals
        : [];
      setIdeas(meals.slice(0, 5));
    } catch (e: any) {
      Alert.alert("AI error", e?.message ?? "Something went wrong");
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }

  function onGenerate() {
    fetchIdeas({ forceNew: true });
  }
  function onRegenerate() {
    fetchIdeas({ forceNew: true });
  }

  function addToMeal(option: MealIdea) {
    router.push({
      pathname: "/(modals)/add-meal",
      params: {
        date,
        meal,
        // Optional prefill keys if your /add-meal modal accepts them:
        name: option.name,
        calories: String(Math.round(option.calories)),
        protein: String(Math.round(option.protein)),
        carbs: String(Math.round(option.carbs)),
        fat: String(Math.round(option.fat)),
        sugar:
          option.sugar != null ? String(Math.round(option.sugar)) : undefined,
        fiber:
          option.fiber != null ? String(Math.round(option.fiber)) : undefined,
      },
    });
  }

  return (<TaskPage title="AI meal ideas" section="AI meal ideas" onBack={() => router.back()}>

    <NutritionContext label={isPro ? "Your meal brief" : "Pro tool"} title="Start with what sounds good" detail="Describe ingredients, preparation time or preferences. Review any generated idea before adding it." icon="sparkles-outline" />
    <Panel><Heading title="Your request" /><Field label="Preferences for this meal" multiline style={{ minHeight: 130, textAlignVertical: "top" }} value={notes} onChangeText={setNotes} placeholder="Ingredients, prep time, dietary preferences…" />

    <Button primary disabled={loading} label={loading ? 'Finding ideas…' : ideas.length ? 'Generate new ideas' : 'Generate ideas'} onPress={ideas.length ? onRegenerate : onGenerate} /></Panel>

    {!ideas.length && !loading && <Empty title="Start with what sounds good" detail="Add preferences above, then request meal suggestions." />}

    {!!ideas.length && <Heading title="Your generated ideas" detail="Nutrition estimates · review the portion before logging" />}
    {ideas.map((idea, i) => <Panel key={i}>
      <Text style={F.eyebrow}>IDEA {String(i + 1).padStart(2, '0')} · {idea.difficulty}</Text>
      <Heading title={idea.name} detail={`${Math.round(idea.calories)} kcal estimated${idea.prep_min != null ? ` · ${idea.prep_min} min prep` : ''}`} />
      <NutritionValues values={[{ label: 'Protein', value: `${Math.round(idea.protein)} g` }, { label: 'Carbs', value: `${Math.round(idea.carbs)} g` }, { label: 'Fat', value: `${Math.round(idea.fat)} g` }]} />
      {idea.sugar != null && <Text style={F.caption}>Sugar {idea.sugar} g</Text>}
      {idea.fiber != null && <Text style={F.caption}>Fiber {idea.fiber} g</Text>}
      {!!idea.notes && <Text style={F.body}>{idea.notes}</Text>}
      <Button label="Review and add" onPress={() => addToMeal(idea)} />
    </Panel>)}
  </TaskPage>
  );
}
