import React from "react";
import { Image, View, type ImageSourcePropType } from "react-native";
import { useTheme } from "@/content/ThemeProvider";

type Background = "dark" | "light";
type Size = "small" | "medium" | "large" | number;
type BrandProps = { size?: Size; background?: Background };

// Checkpoint 1B approved drawings only. “dark” means artwork for a dark surface.
const assets = {
  somata: require("../../assets/branding/somata/symbol-color.png"),
  fitadapt: require("../../assets/branding/fitadapt/symbol-color.png"),
  horizontal: {
    dark: require("../../assets/branding/reconciled-1b/somata/horizontal-s3-dark.png"),
    light: require("../../assets/branding/reconciled-1b/somata/horizontal-s3-light.png"),
  },
  stacked: {
    dark: require("../../assets/branding/reconciled-1b/somata/stacked-s3-dark.png"),
    light: require("../../assets/branding/reconciled-1b/somata/stacked-s3-light.png"),
  },
  fitadaptLogo: {
    dark: require("../../assets/branding/reconciled-1b/fitadapt/horizontal-f3-dark.png"),
    light: require("../../assets/branding/reconciled-1b/fitadapt/horizontal-f3-light.png"),
  },
  powered: {
    dark: require("../../assets/branding/reconciled-1b/fitadapt/powered-by-f3-compact-dark.png"),
    light: require("../../assets/branding/reconciled-1b/fitadapt/powered-by-f3-compact-light.png"),
  },
};

function width(size: Size, sizes: Record<Exclude<Size, number>, number>) {
  return typeof size === "number" && Number.isFinite(size) && size > 0 ? size :
    typeof size === "string" ? sizes[size] : sizes.medium;
}

/** Preserve the full raster canvas and aspect ratio, even inside narrow cards. */
function Artwork({ source, size, label }: { source: ImageSourcePropType; size: number; label: string }) {
  const { width: imageWidth, height } = Image.resolveAssetSource(source);
  return <View style={{ width: size, maxWidth: "100%", aspectRatio: imageWidth / height, flexShrink: 1 }}>
    <Image source={source} resizeMode="contain" accessible accessibilityRole="image"
      accessibilityLabel={label} style={{ width: "100%", height: "100%" }} />
  </View>;
}

function useBackground(background?: Background): Background {
  const { isDark } = useTheme();
  return background ?? (isDark ? "dark" : "light");
}

/** Use a symbol on compact surfaces; full lockups include the approved tagline. */
export function SomataLogo({ size = "medium", background, layout = "horizontal" }:
  BrandProps & { layout?: "horizontal" | "stacked" }) {
  const surface = useBackground(background);
  return <Artwork source={assets[layout][surface]} label="Somata"
    size={width(size, { small: 280, medium: 320, large: 400 })} />;
}

export function SomataSymbol({ size = "medium" }: Pick<BrandProps, "size">) {
  return <Artwork source={assets.somata} label="Somata"
    size={width(size, { small: 28, medium: 48, large: 120 })} />;
}

export function FitAdaptLogo({ size = "medium", background }: BrandProps) {
  const surface = useBackground(background);
  return <Artwork source={assets.fitadaptLogo[surface]} label="FitAdapt"
    size={width(size, { small: 280, medium: 320, large: 400 })} />;
}

export function FitAdaptSymbol({ size = "medium" }: Pick<BrandProps, "size">) {
  return <Artwork source={assets.fitadapt} label="FitAdapt"
    size={width(size, { small: 28, medium: 48, large: 120 })} />;
}

/** Attribution only: callers retain their existing live-result/accepted-plan guards. */
export function PoweredByFitAdapt({ size = "small", background }: BrandProps) {
  const surface = useBackground(background);
  return <Artwork source={assets.powered[surface]} label="Powered by FitAdapt"
    size={width(size, { small: 240, medium: 280, large: 320 })} />;
}
