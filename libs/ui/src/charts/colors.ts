/**
 * Categorical series colors in fixed order (never cycled). Validated for
 * color-vision deficiency on the white card surface: the 3rd and 4th sit
 * below 3:1 contrast, so every chart using them has a legend with values
 * and a table view.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"] as const;
