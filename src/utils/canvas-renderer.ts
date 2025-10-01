export interface TileData {
  title: string;
  value: string;
  percentageChange?: number;
  backgroundColor?: string;
  textColor?: string;
}

export interface Theme {
  background: string;
  text: string;
  positive: string;
  negative: string;
}

export const themes = {
  dark: {
    background: "#1a1a2e",
    text: "#ffffff",
    positive: "#00ff00",
    negative: "#ff0000",
  },
  blue: {
    background: "#0f3460",
    text: "#ffffff",
    positive: "#16c784",
    negative: "#ea3943",
  },
  modern: {
    background: "#2d3436",
    text: "#dfe6e9",
    positive: "#00b894",
    negative: "#d63031",
  },
};

/**
 * Renders a custom tile using SVG and Sharp
 * Simple, robust, works on Windows and Mac
 */
export async function renderTile(data: TileData): Promise<string> {
  const {
    title,
    value,
    percentageChange,
    backgroundColor = "#1a1a2e",
    textColor = "#ffffff",
  } = data;

  // Determine percentage color (green for positive, red for negative)
  const isPositive = percentageChange !== undefined && percentageChange >= 0;
  const percentageColor =
    percentageChange === undefined
      ? textColor
      : isPositive
      ? "#16c784"
      : "#ea3943";

  // Format percentage display
  const percentageText =
    percentageChange === undefined
      ? ""
      : `${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(1)}%`;

  // SVG arrow paths
  const upArrow = `<path d="M 72 114 L 76 118 L 68 118 Z" fill="#16c784"/>`; // Triangle pointing up
  const downArrow = `<path d="M 72 118 L 76 114 L 68 114 Z" fill="#ea3943"/>`; // Triangle pointing down

  // Create SVG (144x144 for @2x, scales to 72x72)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="144" height="144" fill="${backgroundColor}"/>
  
  <!-- Title at top -->
  <text
    x="72"
    y="25"
    font-family="Arial, sans-serif"
    font-size="14"
    font-weight="600"
    fill="${textColor}"
    text-anchor="middle"
    opacity="0.8"
  >${escapeXml(title)}</text>
  
  <!-- Main value in middle -->
  <text
    x="72"
    y="85"
    font-family="Arial, sans-serif"
    font-size="36"
    font-weight="bold"
    fill="${textColor}"
    text-anchor="middle"
  >${escapeXml(value)}</text>
  
  <!-- Percentage change at bottom with arrow -->
  ${
    percentageText
      ? `
  <!-- Arrow indicator -->
  ${percentageChange !== 0 ? (isPositive ? upArrow : downArrow) : ""}
  
  <!-- Percentage text -->
  <text
    x="82"
    y="134"
    font-family="Arial, sans-serif"
    font-size="16"
    font-weight="600"
    fill="${percentageColor}"
    text-anchor="middle"
  >${escapeXml(percentageText)}</text>`
      : ""
  }
</svg>`;

  // Return SVG as base64 data URL (Stream Deck supports SVG)
  const base64Svg = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64Svg}`;
}

/**
 * Format large numbers for display
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Escape XML special characters for SVG
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

