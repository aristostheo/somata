import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { authPalette } from "../components/somata/authPalette";
import { contrastRatio } from "../lib/themeColor";

test("authentication text and control boundaries maintain contrast in both modes", () => {
  for (const dark of [false, true]) {
    const c = authPalette(dark);
    for (const background of [c.bg, c.card]) {
      for (const foreground of [c.text, c.muted, c.accent, c.danger]) {
        assert(contrastRatio(foreground, background) >= 4.5, `${foreground} on ${background}`);
      }
    }
    assert(contrastRatio(c.onPrimary, c.primary) >= 4.5);
    assert(contrastRatio(c.onPrimary, c.pressed) >= 4.5);
    assert(contrastRatio(c.muted, c.disabled) >= 4.5);
    assert(contrastRatio(c.border, c.card) >= 3);
  }
});

test("brand images override React Native's intrinsic PNG dimensions inside their bounded box", () => {
  const file = resolve("components/brand/Brand.tsx");
  const nativeRequire = createRequire(file);
  const Image = Object.assign(() => null, { resolveAssetSource: (source: unknown) => source });
  const exports: Record<string, any> = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => {
    if (name === "react-native") return { Image, View: "View" };
    if (name === "@/content/ThemeProvider") return { useTheme: () => ({ isDark: true }) };
    if (name.endsWith(".png")) {
      const bytes = readFileSync(resolve(dirname(file), name));
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), uri: name };
    }
    return nativeRequire(name);
  } });
  for (const name of ["SomataLogo", "SomataSymbol", "FitAdaptLogo", "FitAdaptSymbol", "PoweredByFitAdapt"]) {
    const element = exports[name]({ size: 280 });
    const box = element.type(element.props);
    const image = box.props.children;
    // Image.ios.js prepends these intrinsic dimensions before the caller's style.
    const nativeStyle = { width: image.props.source.width, height: image.props.source.height, ...image.props.style };
    assert.equal(nativeStyle.width, "100%", `${name} must not retain native PNG width`);
    assert.equal(nativeStyle.height, "100%", `${name} must not retain native PNG height`);
    assert.equal(image.props.resizeMode, "contain");
    assert.equal(box.props.style.aspectRatio, image.props.source.width / image.props.source.height);
    assert.equal(box.props.style.maxWidth, "100%");
    for (const available of [240, 272, 342]) {
      const renderedWidth = Math.min(available, box.props.style.width);
      assert(renderedWidth <= available);
      assert(renderedWidth / box.props.style.aspectRatio > 0);
    }
  }
});
