import {
  defaultEnabledFor,
  MODULE_FEATURE_ENV_VAR,
  ModuleKey,
} from "./module-phase";

/** Generic boolean env-var reader: "true"/"1" (case-insensitive) => enabled. */
export function isFeatureEnabled(
  envVar: string,
  defaultValue = false,
): boolean {
  const raw = process.env[envVar];
  if (raw === undefined || raw === "") return defaultValue;
  return raw.toLowerCase() === "true" || raw === "1";
}

/** Whether the given module's feature flag is on, using its PRD-phase default when unset. */
export function isModuleEnabled(moduleKey: ModuleKey): boolean {
  return isFeatureEnabled(
    MODULE_FEATURE_ENV_VAR[moduleKey],
    defaultEnabledFor(moduleKey),
  );
}
