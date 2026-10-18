import { Panel, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { Text, View } from "react-native";

import { useTheme } from "@/content/ThemeProvider";

export default function ExplainAIModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { D, F } = useSomataTheme();

  const { colors } = useTheme() as any;

  return (<TaskSheet title="Scanning, explained" visible={visible} onClose={onClose}>

    <Panel accent>
      <Text style={F.heading}>You decide what gets logged.</Text>
      <Text style={F.body}>The scan suggests foods and portions. Nothing is logged until you review and confirm.</Text>
    </Panel>

    {[
      ['01', 'Check the confidence', 'High, medium and low confidence help you decide what to keep, edit or remove.'],
      ['02', 'Refine the result', 'Change food names, portions, units and macros, or add anything the scan missed.'],
      ['03', 'Give the camera a clear view', 'Lighting, angle, hidden ingredients and portion visibility affect detection. Include the whole plate and avoid harsh shadows.']
    ].map(([number, title, body]) => <View key={number} style={{ flexDirection: 'row', gap: 15 }}>
      <Text style={F.eyebrow}>{number}</Text>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={F.heading}>{title}</Text>
        <Text style={F.body}>{body}</Text>
      </View>
    </View>)}
  </TaskSheet>
  );
}
