import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/content/ThemeProvider";
import PremiumModalSheet from "@/components/ui/PremiumModalSheet";

function Bullet({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme() as any;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          marginTop: 6,
          backgroundColor: colors.primary,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: "900" }}>
          {title}
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 12.5,
            lineHeight: 18,
            marginTop: 3,
            fontWeight: "700",
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

export default function ExplainAIModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme() as any;

  return (
    <PremiumModalSheet
      visible={visible}
      onClose={onClose}
      title="Scanning, explained"
      subtitle="Calm, transparent AI with you in control."
      detached
    >
      <Bullet
        title="We detect items, then you confirm"
        body="The scan suggests foods and portions. Nothing is logged until you review and press Confirm."
      />
      <Bullet
        title="Confidence labels are shown"
        body="High, Medium, and Low confidence help you decide what to keep, edit, or remove."
      />
      <Bullet
        title="You can edit anything"
        body="Change item name, portion, units, or macros, or add anything that was missed."
      />
      <Bullet
        title="Why results can vary"
        body="Lighting, angle, hidden ingredients, and portion visibility can affect detection."
      />
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          opacity: 0.5,
        }}
      />
      <Text style={{ color: colors.muted, fontSize: 12.25, lineHeight: 17 }}>
        Tip: For best results, include the full plate and avoid harsh shadows.
      </Text>
    </PremiumModalSheet>
  );
}
