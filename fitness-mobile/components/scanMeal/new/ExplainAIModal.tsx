import { NutritionContext } from "@/components/nutrition/NutritionTaskUI";
import { Panel, TaskSheet } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { Text, View } from "react-native";

import { useTheme } from "@/content/ThemeProvider";

export default function ExplainAIModal(props: Parameters<typeof ExplainAIModalContent>[0]) {
  return <SomataTaskAppearance><ExplainAIModalContent {...props} /></SomataTaskAppearance>;
}

function ExplainAIModalContent({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { D, F } = useTaskPresentation();

  const { colors } = useTheme() as any;

  return (<TaskSheet title="Scanning, explained" visible={visible} onClose={onClose}>

    <NutritionContext label="You are in control" title="You decide what gets logged." detail="The scan suggests foods and portions. Nothing is logged until you review and confirm." icon="shield-checkmark-outline" />

    {[
      ['01', 'Check the confidence', 'High, medium and low confidence help you decide what to keep, edit or remove.'],
      ['02', 'Refine the result', 'Change food names, portions, units and macros, or add anything the scan missed.'],
      ['03', 'Give the camera a clear view', 'Lighting, angle, hidden ingredients and portion visibility affect detection. Include the whole plate and avoid harsh shadows.']
    ].map(([number, title, body]) => <Panel key={number}><View style={{ flexDirection: "row", gap: 15 }}>
      <Text style={F.eyebrow}>{number}</Text>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={F.heading}>{title}</Text>
        <Text style={F.body}>{body}</Text>
      </View>
    </View></Panel>)}
  </TaskSheet>
  );
}
