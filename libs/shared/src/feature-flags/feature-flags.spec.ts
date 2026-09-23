import { isFeatureEnabled, isModuleEnabled } from "./feature-flags";
import { ModuleKey } from "./module-phase";

describe("isFeatureEnabled", () => {
  const ENV_VAR = "TEST_FEATURE_FLAG";
  const originalValue = process.env[ENV_VAR];

  afterEach(() => {
    if (originalValue === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = originalValue;
  });

  it("returns the default when the env var is unset", () => {
    delete process.env[ENV_VAR];
    expect(isFeatureEnabled(ENV_VAR, true)).toBe(true);
    expect(isFeatureEnabled(ENV_VAR, false)).toBe(false);
  });

  it("returns the default when the env var is an empty string", () => {
    process.env[ENV_VAR] = "";
    expect(isFeatureEnabled(ENV_VAR, true)).toBe(true);
  });

  it.each(["true", "TRUE", "True", "1"])(
    "treats %p as enabled",
    (value) => {
      process.env[ENV_VAR] = value;
      expect(isFeatureEnabled(ENV_VAR)).toBe(true);
    },
  );

  it.each(["false", "FALSE", "0", "no", "off"])(
    "treats %p as disabled",
    (value) => {
      process.env[ENV_VAR] = value;
      expect(isFeatureEnabled(ENV_VAR, true)).toBe(false);
    },
  );
});

describe("isModuleEnabled", () => {
  const PHASE_1_ENV_VARS = [
    "FEATURE_VENDOR_MANAGEMENT_ENABLED",
    "FEATURE_PROCUREMENT_ENABLED",
    "FEATURE_INVENTORY_ENABLED",
  ];
  const PHASE_2_ENV_VARS = [
    "FEATURE_RECEIVING_ENABLED",
    "FEATURE_WAREHOUSE_OPERATIONS_ENABLED",
  ];
  const PHASE_3_4_ENV_VARS = [
    "FEATURE_RETAIL_SALES_ENABLED",
    "FEATURE_SALES_AUDIT_ENABLED",
    "FEATURE_FINANCIALS_ENABLED",
  ];
  const ALL_ENV_VARS = [
    ...PHASE_1_ENV_VARS,
    ...PHASE_2_ENV_VARS,
    ...PHASE_3_4_ENV_VARS,
  ];
  const originalValues = Object.fromEntries(
    ALL_ENV_VARS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of ALL_ENV_VARS) {
      const original = originalValues[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  it("defaults Phase 1 modules (vendor-management, procurement, inventory) to enabled", () => {
    delete process.env.FEATURE_VENDOR_MANAGEMENT_ENABLED;
    delete process.env.FEATURE_PROCUREMENT_ENABLED;
    delete process.env.FEATURE_INVENTORY_ENABLED;

    expect(isModuleEnabled(ModuleKey.VENDOR_MANAGEMENT)).toBe(true);
    expect(isModuleEnabled(ModuleKey.PROCUREMENT)).toBe(true);
    expect(isModuleEnabled(ModuleKey.INVENTORY)).toBe(true);
  });

  it("defaults Phase 2 modules (receiving, warehouse-operations) to enabled", () => {
    delete process.env.FEATURE_RECEIVING_ENABLED;
    delete process.env.FEATURE_WAREHOUSE_OPERATIONS_ENABLED;

    expect(isModuleEnabled(ModuleKey.RECEIVING)).toBe(true);
    expect(isModuleEnabled(ModuleKey.WAREHOUSE_OPERATIONS)).toBe(true);
  });

  it("defaults Phase 3-4 modules to disabled", () => {
    delete process.env.FEATURE_RETAIL_SALES_ENABLED;
    delete process.env.FEATURE_SALES_AUDIT_ENABLED;
    delete process.env.FEATURE_FINANCIALS_ENABLED;

    expect(isModuleEnabled(ModuleKey.RETAIL_SALES)).toBe(false);
    expect(isModuleEnabled(ModuleKey.SALES_AUDIT)).toBe(false);
    expect(isModuleEnabled(ModuleKey.FINANCIALS)).toBe(false);
  });

  it("lets an explicit env var override a Phase 1 module's default", () => {
    process.env.FEATURE_INVENTORY_ENABLED = "false";
    expect(isModuleEnabled(ModuleKey.INVENTORY)).toBe(false);
  });

  it("lets an explicit env var override a later-phase module's default", () => {
    process.env.FEATURE_RETAIL_SALES_ENABLED = "true";
    expect(isModuleEnabled(ModuleKey.RETAIL_SALES)).toBe(true);
  });

  it("lets an explicit env var switch off a Phase 2 module", () => {
    process.env.FEATURE_RECEIVING_ENABLED = "false";
    expect(isModuleEnabled(ModuleKey.RECEIVING)).toBe(false);
  });
});
