import { appAt, appsFor, MMS_APPS } from "../apps";

describe("appsFor", () => {
  const ids = (role: Parameters<typeof appsFor>[0]) => appsFor(role).map((app) => app.id);

  it("gives owners and managers every app", () => {
    expect(ids("OWNER")).toEqual(Object.keys(MMS_APPS));
    expect(ids("MANAGER")).toEqual(Object.keys(MMS_APPS));
  });

  it("gives each other role only the apps it may use", () => {
    expect(ids("CASHIER")).toEqual(["pos"]);
    expect(ids("ACCOUNTANT")).toEqual(["finance"]);
    expect(ids("BUYER")).toEqual(["vendors", "procurement", "inventory"]);
    expect(ids("WAREHOUSE_STAFF")).toEqual(["inventory", "receiving", "warehouse"]);
  });
});

describe("appAt", () => {
  it("finds the app served from an origin", () => {
    expect(appAt("http://localhost:3106")?.id).toBe("pos");
    expect(appAt("http://localhost:3109")?.id).toBe("dashboard");
  });

  it("returns undefined for an unknown origin", () => {
    expect(appAt("https://www.example.com")).toBeUndefined();
  });
});
