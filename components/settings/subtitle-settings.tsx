/**
 * Enhanced Subtitle Settings Component
 * Advanced customization for subtitle appearance
 */

"use client";

import { useState } from "react";
import { useStore } from "@/store";
import {
  Type,
  Palette,
  AlignCenter,
  Maximize,
  Minimize,
  Eye,
  Sun,
  Move,
  Box,
} from "lucide-react";

interface SubtitleSettingsProps {
  className?: string;
}

const FONT_FAMILIES = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Roboto, sans-serif", label: "Roboto" },
  { value: "Open Sans, sans-serif", label: "Open Sans" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Courier New, monospace", label: "Courier New" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "Impact, sans-serif", label: "Impact" },
];

const EDGE_STYLES = [
  { value: "none", label: "None" },
  { value: "raised", label: "Raised" },
  { value: "depressed", label: "Depressed" },
  { value: "uniform", label: "Uniform" },
  { value: "drop-shadow", label: "Drop Shadow" },
];

const POSITIONS = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

const PRESET_THEMES = [
  {
    name: "Classic White",
    style: {
      fontSize: 20,
      fontFamily: "Arial, sans-serif",
      fontColor: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 50,
      position: "bottom" as const,
      edgeStyle: "drop-shadow" as const,
      textShadow: true,
      windowColor: "#000000",
      windowOpacity: 0,
    },
  },
  {
    name: "Yellow Band",
    style: {
      fontSize: 22,
      fontFamily: "Arial, sans-serif",
      fontColor: "#FFFF00",
      backgroundColor: "#000000",
      backgroundOpacity: 80,
      position: "bottom" as const,
      edgeStyle: "uniform" as const,
      textShadow: false,
      windowColor: "#000000",
      windowOpacity: 0,
    },
  },
  {
    name: "Modern Clean",
    style: {
      fontSize: 18,
      fontFamily: "Roboto, sans-serif",
      fontColor: "#FFFFFF",
      backgroundColor: "#1a1a1a",
      backgroundOpacity: 70,
      position: "bottom" as const,
      edgeStyle: "none" as const,
      textShadow: false,
      windowColor: "#000000",
      windowOpacity: 0,
    },
  },
  {
    name: "High Contrast",
    style: {
      fontSize: 24,
      fontFamily: "Verdana, sans-serif",
      fontColor: "#00FF00",
      backgroundColor: "#000000",
      backgroundOpacity: 100,
      position: "bottom" as const,
      edgeStyle: "uniform" as const,
      textShadow: false,
      windowColor: "#000000",
      windowOpacity: 0,
    },
  },
];

export function SubtitleSettings({ className = "" }: SubtitleSettingsProps) {
  const { preferences, updatePreferences } = useStore();
  const [previewText, setPreviewText] = useState("This is how your subtitles will look");

  // Provide default values for existing users without subtitleStyle
  // Also handle case where preferences might be undefined during hydration
  const subtitleStyle = preferences?.subtitleStyle || {
    fontSize: 20,
    fontFamily: "Arial, sans-serif",
    fontColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 50,
    position: "bottom" as const,
    edgeStyle: "drop-shadow" as const,
    textShadow: true,
    windowColor: "#000000",
    windowOpacity: 0,
  };

  const updateStyle = (updates: Partial<typeof subtitleStyle>) => {
    updatePreferences({
      subtitleStyle: { ...subtitleStyle, ...updates },
    });
  };

  const applyPreset = (preset: typeof PRESET_THEMES[number]) => {
    updatePreferences({ subtitleStyle: preset.style });
  };

  // Generate CSS for preview
  const getPreviewStyle = () => {
    const bgColor = subtitleStyle.backgroundColor +
      Math.round((subtitleStyle.backgroundOpacity / 100) * 255).toString(16).padStart(2, "0");

    let textShadowValue = "";
    switch (subtitleStyle.edgeStyle) {
      case "raised":
        textShadowValue = "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
        break;
      case "depressed":
        textShadowValue = "1px 1px 0 #FFF, -1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF";
        break;
      case "uniform":
        textShadowValue = "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
        break;
      case "drop-shadow":
        textShadowValue = "2px 2px 4px rgba(0, 0, 0, 0.8)";
        break;
      case "none":
      default:
        textShadowValue = subtitleStyle.textShadow ? "2px 2px 4px rgba(0, 0, 0, 0.8)" : "none";
        break;
    }

    return {
      fontSize: `${subtitleStyle.fontSize}px`,
      fontFamily: subtitleStyle.fontFamily,
      color: subtitleStyle.fontColor,
      backgroundColor: bgColor,
      textShadow: textShadowValue,
      padding: "8px 16px",
      borderRadius: "4px",
      maxWidth: "80%",
    };
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Preset Themes */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Preset Themes
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESET_THEMES.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-primary/50"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Type className="w-4 h-4" />
          Font Size: {subtitleStyle.fontSize}px
        </h4>
        <input
          type="range"
          min="14"
          max="36"
          value={subtitleStyle.fontSize}
          onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>14px</span>
          <span>36px</span>
        </div>
      </div>

      {/* Font Family */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Type className="w-4 h-4" />
          Font Family
        </h4>
        <select
          value={subtitleStyle.fontFamily}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Font Color */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Font Color
          </h4>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={subtitleStyle.fontColor}
              onChange={(e) => updateStyle({ fontColor: e.target.value })}
              className="w-12 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={subtitleStyle.fontColor}
              onChange={(e) => updateStyle({ fontColor: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none uppercase"
              maxLength={7}
            />
          </div>
        </div>

        {/* Background Color */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Box className="w-4 h-4" />
            Background Color
          </h4>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={subtitleStyle.backgroundColor}
              onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
              className="w-12 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={subtitleStyle.backgroundColor}
              onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none uppercase"
              maxLength={7}
            />
          </div>
        </div>
      </div>

      {/* Background Opacity */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Sun className="w-4 h-4" />
          Background Opacity: {subtitleStyle.backgroundOpacity}%
        </h4>
        <input
          type="range"
          min="0"
          max="100"
          value={subtitleStyle.backgroundOpacity}
          onChange={(e) => updateStyle({ backgroundOpacity: Number(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Position */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <AlignCenter className="w-4 h-4" />
          Position
        </h4>
        <div className="flex gap-2">
          {POSITIONS.map((pos) => (
            <button
              key={pos.value}
              onClick={() => updateStyle({ position: pos.value as typeof subtitleStyle.position })}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                subtitleStyle.position === pos.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Edge Style */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Move className="w-4 h-4" />
          Edge Style
        </h4>
        <select
          value={subtitleStyle.edgeStyle}
          onChange={(e) => updateStyle({ edgeStyle: e.target.value as typeof subtitleStyle.edgeStyle })}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
        >
          {EDGE_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      {/* Text Shadow Toggle */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Maximize className="w-4 h-4" />
          Additional Text Shadow
        </h4>
        <button
          onClick={() => updateStyle({ textShadow: !subtitleStyle.textShadow })}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            subtitleStyle.textShadow ? "bg-primary" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              subtitleStyle.textShadow ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Preview Section */}
      <div className="border-t border-white/10 pt-6">
        <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Preview
        </h4>

        {/* Preview Box */}
        <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-8 min-h-[200px] flex items-center justify-center">
          <div
            className={`absolute ${
              subtitleStyle.position === "top"
                ? "top-8"
                : subtitleStyle.position === "middle"
                ? "top-1/2 -translate-y-1/2"
                : "bottom-8"
            } left-1/2 -translate-x-1/2 text-center`}
            style={getPreviewStyle()}
          >
            {previewText}
          </div>
        </div>

        {/* Custom Preview Text Input */}
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Enter custom preview text..."
          className="mt-4 w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
