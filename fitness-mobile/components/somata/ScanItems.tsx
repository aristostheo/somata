import { NutritionValues } from "@/components/nutrition/NutritionTaskUI";
import type { DetectedFood, MacroTotals } from '@/components/scanMeal/new/types';
import { useTaskPresentation } from "@/components/designPreview/Appearance";
import { Text, View } from 'react-native';
import { Button, Empty, Heading, IconButton, Panel } from './TaskUI';
export function ScanItems({ foods, totals, onEdit, onRemove, onAdjust, onAdd, step = 1 }: { foods: DetectedFood[]; totals: MacroTotals; onEdit: (food: DetectedFood) => void; onRemove: (id: string) => void; onAdjust: (id: string, delta: number) => void; onAdd: () => void; step?: number; }) {
  const { D, F } = useTaskPresentation();

  return <><Panel accent>
    <Text style={F.eyebrow}>ESTIMATED MEAL TOTAL</Text>
    <NutritionValues values={[
      { label: 'Energy', value: `${Math.round(totals.calories)} kcal` }, { label: 'Protein', value: `${Math.round(totals.protein)} g` },
      { label: 'Carbs', value: `${Math.round(totals.carbs)} g` }, { label: 'Fat', value: `${Math.round(totals.fat)} g` },
    ]} />

    <Text style={F.caption}>Review the foods and portions before logging. Estimates can change when you edit an item.</Text>
  </Panel>
    <Heading title="Review each item" detail="Confidence reflects the scan, not a judgment about your food." />
    {!foods.length && <Empty title="No items detected" detail="Add an item or try another photo." />}
    {foods.map((food, index) => <Panel key={food.id}>

      <View style={F.row}>
        <Text style={{ ...F.eyebrow, flex: 1 }}>ITEM {String(index + 1).padStart(2, '0')} · {food.confidence.toUpperCase()}</Text>
        <IconButton icon="trash-outline" label={`Remove ${food.name}`} onPress={() => onRemove(food.id)} />
      </View>

      <Heading title={food.name} detail={`${Math.round(food.macros.calories)} kcal · P ${Math.round(food.macros.protein)} g · C ${Math.round(food.macros.carbs)} g · F ${Math.round(food.macros.fat)} g`} />

      <View style={{ ...F.row, flexWrap: "wrap", backgroundColor: D.low, padding: 12, borderRadius: 16 }}>
        <Text style={{ ...F.heading, flexGrow: 1, color: D.teal }}>{food.portion.amount} {food.portion.unit}</Text>
        <IconButton icon="remove" label={`Decrease portion of ${food.name}`} onPress={() => onAdjust(food.id, -step)} />
        <IconButton icon="add" label={`Increase portion of ${food.name}`} onPress={() => onAdjust(food.id, step)} />
      </View>

      <Button label="Edit food & nutrition" icon="create-outline" onPress={() => onEdit(food)} />

    </Panel>)}<Button label="Add missing item" icon="add" onPress={onAdd} /></>;
}
