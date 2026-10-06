// components/nutrition/uiNew/PremiumHydrationBottle.tsx
// Drop-in ✅ (Skia + Reanimated, no useClockValue/useComputedValue)
//
// Requires:
//   npx expo install @shopify/react-native-skia
//   react-native-reanimated
//
// Works with modern Skia versions by avoiding deprecated hooks.

import React, { useEffect, useMemo, useRef } from "react";
import { ViewStyle, AccessibilityInfo } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import {
  Canvas,
  Group,
  Path,
  RoundedRect,
  LinearGradient,
  BlurMask,
  Shadow,
  Skia,
} from "@shopify/react-native-skia";

type BottleColors = {
  glass: string;
  glassInner: string;
  highlight: string;
  waterTop: string;
  waterMid: string;
  waterBottom: string;
  glow: string;
};

function clamp(n: number, a: number, b: number) {
  "worklet";
  return Math.max(a, Math.min(b, n));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  "worklet";
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith("rgb")) {
    const body = color.replace(/^rgba?\(|\)$/g, "");
    const [r, g, b] = body.split(",").map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(
    m[3],
    16
  )}, ${alpha})`;
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => {
      if (mounted) setReduced(!!v);
    });
    const sub =
      AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
        setReduced(!!v);
      }) ?? null;

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/** Builds a bottle silhouette path in local coordinates */
function buildBottlePath(w: number, h: number) {
  const pad = Math.max(10, Math.round(Math.min(w, h) * 0.06));
  const bw = w - pad * 2;
  const bh = h - pad * 2;

  const x = pad;
  const y = pad;

  const neckW = bw * 0.34;
  const neckH = bh * 0.18;
  const shoulderH = bh * 0.14;

  const cx = x + bw / 2;

  const bodyBottomY = y + bh;

  const neckLeft = cx - neckW / 2;
  const neckRight = cx + neckW / 2;

  const bodyRadius = bw * 0.18;

  const p = Skia.Path.Make();

  p.moveTo(neckLeft, y + neckH * 0.12);
  p.quadTo(neckLeft, y, cx, y);
  p.quadTo(neckRight, y, neckRight, y + neckH * 0.12);

  p.lineTo(neckRight, y + neckH * 0.92);

  p.cubicTo(
    neckRight,
    y + neckH + shoulderH * 0.25,
    cx + bw * 0.48,
    y + neckH + shoulderH * 0.25,
    x + bw,
    y + neckH + shoulderH
  );

  p.lineTo(x + bw, bodyBottomY - bodyRadius);
  p.quadTo(x + bw, bodyBottomY, x + bw - bodyRadius, bodyBottomY);
  p.lineTo(x + bodyRadius, bodyBottomY);
  p.quadTo(x, bodyBottomY, x, bodyBottomY - bodyRadius);
  p.lineTo(x, y + neckH + shoulderH);

  p.cubicTo(
    x + bw * 0.02,
    y + neckH + shoulderH * 0.25,
    neckLeft,
    y + neckH + shoulderH * 0.25,
    neckLeft,
    y + neckH * 0.92
  );

  p.close();
  return { path: p };
}

function insetPath(original: any, inset: number) {
  const bounds = original.getBounds();
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const sx = (bounds.width - inset * 2) / bounds.width;
  const sy = (bounds.height - inset * 2) / bounds.height;

  const m = Skia.Matrix();
  m.translate(cx, cy);
  m.scale(sx, sy);
  m.translate(-cx, -cy);

  const p = original.copy();
  p.transform(m);
  return p;
}

function makeWaterPath(
  contentRect: { x: number; y: number; w: number; h: number },
  fill: number,
  phase: number,
  amp: number,
  bumpPx: number
) {
  "worklet";
  const p = Skia.Path.Make();

  const x0 = contentRect.x;
  const x1 = contentRect.x + contentRect.w;
  const yBottom = contentRect.y + contentRect.h;

  const baseY = yBottom - contentRect.h * fill;

  // tiny puddle at low fill
  const minFill = 0.018;
  const puddleY = yBottom - contentRect.h * minFill;
  const y = fill < minFill ? puddleY : baseY;

  const midX = (x0 + x1) / 2;

  const yL = y + Math.sin(phase) * amp - bumpPx;
  const yM = y + Math.sin(phase + 1.6) * (amp * 0.75) - bumpPx;
  const yR = y + Math.sin(phase + 3.2) * amp - bumpPx;

  p.moveTo(x0, yL);
  p.quadTo(midX, yM, x1, yR);
  p.lineTo(x1, yBottom);
  p.lineTo(x0, yBottom);
  p.close();

  return p;
}

function makeMeniscusPath(
  contentRect: { x: number; y: number; w: number; h: number },
  fill: number,
  phase: number,
  amp: number,
  bumpPx: number
) {
  "worklet";
  const p = Skia.Path.Make();

  const x0 = contentRect.x;
  const x1 = contentRect.x + contentRect.w;
  const yBottom = contentRect.y + contentRect.h;

  const baseY = yBottom - contentRect.h * Math.max(fill, 0.018);

  const midX = (x0 + x1) / 2;

  const yL = baseY + Math.sin(phase) * amp - bumpPx;
  const yM = baseY + Math.sin(phase + 1.6) * (amp * 0.75) - bumpPx;
  const yR = baseY + Math.sin(phase + 3.2) * amp - bumpPx;

  p.moveTo(x0, yL);
  p.quadTo(midX, yM, x1, yR);
  return p;
}

function makePourPath(innerPath: any) {
  const p = Skia.Path.Make();
  const b = innerPath.getBounds();

  const streamX = b.x + b.width * 0.52;
  const topY = b.y - b.height * 0.08;
  const hitY = b.y + b.height * 0.2;

  const w = b.width * 0.06;

  p.moveTo(streamX - w * 0.35, topY);
  p.cubicTo(
    streamX - w * 0.45,
    topY + 20,
    streamX - w * 0.2,
    hitY - 18,
    streamX - w * 0.12,
    hitY
  );
  p.lineTo(streamX + w * 0.12, hitY);
  p.cubicTo(
    streamX + w * 0.2,
    hitY - 18,
    streamX + w * 0.45,
    topY + 20,
    streamX + w * 0.35,
    topY
  );
  p.close();

  return p;
}

export function PremiumHydrationBottle({
  width,
  height,
  currentMl,
  goalMl,
  logTick = 0,
  lastDeltaMl = 250,
  style,
  colors,
}: {
  width: number;
  height: number;
  currentMl: number;
  goalMl: number;
  logTick?: number;
  lastDeltaMl?: number;
  style?: ViewStyle;
  colors: BottleColors;
}) {
  const reducedMotion = useReducedMotion();

  const progress = goalMl > 0 ? currentMl / goalMl : 0;
  const visualP = Math.max(0, Math.min(1, progress));

  const prevProgressRef = useRef(progress);
  const waterPalette = useMemo(
    () => ({
      top: "rgba(200, 240, 255, 0.95)",
      mid: "rgba(120, 200, 255, 0.85)",
      bottom: "rgba(60, 150, 255, 0.85)",
    }),
    []
  );
  const bottleGlass = useMemo(
    () => ({
      glass: withAlpha(waterPalette.mid, 0.28),
      glassInner: withAlpha(waterPalette.bottom, 0.18),
      highlight: withAlpha(waterPalette.top, 0.22),
    }),
    [waterPalette.bottom, waterPalette.mid, waterPalette.top]
  );

  // Reanimated drivers
  const level = useSharedValue(visualP);
  const pour = useSharedValue(0);
  const splash = useSharedValue(0);
  const completePulse = useSharedValue(0);
  const glint = useSharedValue(0);
  const wavePhase = useSharedValue(0);

  // idle wave phase loop
  useEffect(() => {
    if (reducedMotion) {
      wavePhase.value = 0;
      return;
    }
    wavePhase.value = 0;
    wavePhase.value = withRepeat(
      withTiming(Math.PI * 2, {
        duration: 7800,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [reducedMotion, wavePhase]);

  // Animate level on change
  useEffect(() => {
    const dur = reducedMotion ? 200 : 1150;
    level.value = withTiming(visualP, {
      duration: dur,
      easing: reducedMotion
        ? Easing.out(Easing.quad)
        : Easing.out(Easing.cubic),
    });

    const prev = prevProgressRef.current;
    if (!reducedMotion && prev < 1 && progress >= 1) {
      completePulse.value = 0;
      completePulse.value = withSequence(
        withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 580, easing: Easing.out(Easing.cubic) })
      );
      glint.value = withSequence(
        withTiming(1, { duration: 220 }),
        withTiming(0, { duration: 1400 })
      );
    }
    prevProgressRef.current = progress;
  }, [visualP, progress, reducedMotion, level, completePulse, glint]);

  // Pour on logTick
  useEffect(() => {
    if (reducedMotion) return;

    pour.value = 0;
    pour.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 360 }),
      withTiming(0, { duration: 220 })
    );

    const bump = Math.max(0.25, Math.min(1, (lastDeltaMl || 250) / 500));
    splash.value = 0;
    splash.value = withSequence(
      withTiming(bump, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 14, stiffness: 140 })
    );
  }, [logTick, lastDeltaMl, reducedMotion, pour, splash]);

  // Build bottle geometry
  const { bottlePath, innerPath, contentRect, pourPath } = useMemo(() => {
    const built = buildBottlePath(width, height);
    const bottlePath = built.path;

    const inset = Math.max(6, Math.round(Math.min(width, height) * 0.035));
    const innerPath = insetPath(bottlePath, inset);

    const b = innerPath.getBounds();
    const m = Math.max(6, Math.round(Math.min(width, height) * 0.03));
    const contentRect = {
      x: b.x + m,
      y: b.y + m,
      w: b.width - m * 2,
      h: b.height - m * 2,
    };

    const pourPath = makePourPath(innerPath);

    return { bottlePath, innerPath, contentRect, pourPath };
  }, [width, height]);

  // Glow intensity (reanimated)
  const glowK = useDerivedValue(() => {
    const v = level.value;
    let g = smoothstep(0.9, 1.0, v);
    const over = Math.max(0, progress - 1);
    g += smoothstep(0.0, 0.2, over) * 0.35;
    return clamp(g, 0, 1);
  }, [progress]);

  // Halo behind bottle
  const haloStyle = useAnimatedStyle(() => {
    const g = glowK.value;
    const p = completePulse.value;
    const intensity = g * 0.8 + p * 0.7;

    return {
      opacity: clamp(intensity, 0, 1),
      transform: [{ scale: 1 + p * 0.06 }],
    };
  });

  const contentX = contentRect.x;
  const contentY = contentRect.y;
  const contentW = contentRect.w;
  const contentH = contentRect.h;

  const water = useDerivedValue(() => {
    const fillNow = level.value;
    const phaseNow = wavePhase.value;
    const splashPx = reducedMotion ? 0 : 10 * splash.value;
    const ampBase = fillNow < 0.1 ? 1.8 : fillNow > 0.88 ? 1.8 : 3.1;
    const amp = reducedMotion ? 0 : ampBase;
    return makeWaterPath(
      { x: contentX, y: contentY, w: contentW, h: contentH },
      fillNow,
      phaseNow,
      amp,
      splashPx
    );
  }, [contentX, contentY, contentW, contentH, reducedMotion]);

  const men = useDerivedValue(() => {
    const fillNow = level.value;
    const phaseNow = wavePhase.value;
    const menAmp = reducedMotion ? 0 : fillNow > 0.88 ? 1.5 : 2.2;
    const bump = reducedMotion ? 0 : 6 * splash.value;
    return makeMeniscusPath(
      { x: contentX, y: contentY, w: contentW, h: contentH },
      fillNow,
      phaseNow,
      menAmp,
      bump
    );
  }, [contentX, contentY, contentW, contentH, reducedMotion]);

  const glintY1 = useDerivedValue(
    () =>
      contentY +
      contentH * 0.22 -
      (reducedMotion ? 0 : 10 * glint.value),
    [contentY, contentH, reducedMotion]
  );
  const glintY2 = useDerivedValue(
    () =>
      contentY +
      contentH * 0.38 -
      (reducedMotion ? 0 : 8 * glint.value),
    [contentY, contentH, reducedMotion]
  );
  const glintY3 = useDerivedValue(
    () =>
      contentY +
      contentH * 0.55 -
      (reducedMotion ? 0 : 6 * glint.value),
    [contentY, contentH, reducedMotion]
  );

  return (
    <Animated.View style={[{ width, height }, style]}>
      {/* Soft halo behind */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: width * 0.1,
            top: height * 0.12,
            width: width * 0.8,
            height: height * 0.86,
            borderRadius: Math.min(width, height) * 0.28,
            backgroundColor: colors.glow,
            shadowColor: colors.glow,
            shadowOpacity: 1,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
          },
          haloStyle,
        ]}
      />

      <Canvas style={{ width, height }}>
        {/* Water clipped to inner bottle */}
        <Group clip={innerPath}>
          <Path path={water}>
            <LinearGradient
              start={{ x: contentRect.x, y: contentRect.y }}
              end={{ x: contentRect.x, y: contentRect.y + contentRect.h }}
              colors={[
                waterPalette.top,
                waterPalette.mid,
                waterPalette.bottom,
              ]}
            />
          </Path>

          {/* Meniscus shadow */}
          <Path
            path={men}
            color={"rgba(0,0,0,0.10)"}
            style="stroke"
            strokeWidth={6}
            strokeCap="round"
            strokeJoin="round"
          >
            <BlurMask blur={4} style="normal" />
          </Path>

          {/* Meniscus highlight */}
          <Path
            path={men}
            color={"rgba(255,255,255,0.35)"}
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
            strokeJoin="round"
          />

          {/* Calm completion glints */}
          {!reducedMotion && (
            <Group opacity={glint}>
              <RoundedRect
                x={contentRect.x + contentRect.w * 0.25}
                y={glintY1}
                width={contentRect.w * 0.06}
                height={contentRect.h * 0.1}
                r={6}
                color={"rgba(255,255,255,0.18)"}
              >
                <BlurMask blur={6} style="normal" />
              </RoundedRect>
              <RoundedRect
                x={contentRect.x + contentRect.w * 0.58}
                y={glintY2}
                width={contentRect.w * 0.05}
                height={contentRect.h * 0.08}
                r={6}
                color={"rgba(255,255,255,0.14)"}
              >
                <BlurMask blur={6} style="normal" />
              </RoundedRect>
              <RoundedRect
                x={contentRect.x + contentRect.w * 0.42}
                y={glintY3}
                width={contentRect.w * 0.04}
                height={contentRect.h * 0.07}
                r={6}
                color={"rgba(255,255,255,0.12)"}
              >
                <BlurMask blur={6} style="normal" />
              </RoundedRect>
            </Group>
          )}
        </Group>

        {/* Pour stream */}
        {!reducedMotion && (
          <Group opacity={pour}>
            <Path path={pourPath} color={"rgba(180,230,255,0.30)"}>
              <BlurMask blur={6} style="normal" />
            </Path>
            <Path
              path={pourPath}
              color={"rgba(255,255,255,0.18)"}
              style="stroke"
              strokeWidth={1.5}
            />
          </Group>
        )}

        {/* Glass */}
        <Group>
          <Path path={bottlePath} color={bottleGlass.glass}>
            <BlurMask blur={1.2} style="normal" />
          </Path>

          <Path path={innerPath} color={bottleGlass.glassInner}>
            <BlurMask blur={1.4} style="normal" />
          </Path>

          <Path
            path={bottlePath}
            color={"rgba(255,255,255,0.26)"}
            style="stroke"
            strokeWidth={2.2}
            strokeJoin="round"
          />
          <Path
            path={innerPath}
            color={"rgba(255,255,255,0.14)"}
            style="stroke"
            strokeWidth={1.6}
            strokeJoin="round"
          />

          <RoundedRect
            x={contentRect.x + contentRect.w * 0.1}
            y={contentRect.y + contentRect.h * 0.06}
            width={contentRect.w * 0.16}
            height={contentRect.h * 0.9}
            r={contentRect.w * 0.08}
            color={bottleGlass.highlight}
          >
            <BlurMask blur={10} style="normal" />
          </RoundedRect>

          <Path path={bottlePath} color={"rgba(0,0,0,0.001)"}>
            <Shadow dx={0} dy={10} blur={18} color={"rgba(0,0,0,0.28)"} />
          </Path>
        </Group>
      </Canvas>
    </Animated.View>
  );
}
