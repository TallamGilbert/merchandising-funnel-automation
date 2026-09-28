import { LocationType } from "../../generated/prisma";
import { LocationsController } from "../locations.controller";
import { LocationsService } from "../locations.service";

describe("LocationsController", () => {
  let controller: LocationsController;
  let locations: Record<"list" | "create" | "findOne" | "update" | "addRegister", jest.Mock>;

  beforeEach(() => {
    locations = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue({ code: "STORE-1" }),
      update: jest.fn().mockResolvedValue({}),
      addRegister: jest.fn().mockResolvedValue({}),
    };
    controller = new LocationsController(locations as unknown as LocationsService);
  });

  it("lists locations by type", async () => {
    await controller.list(LocationType.STORE, undefined);
    expect(locations.list).toHaveBeenCalledWith({ type: LocationType.STORE, includeInactive: undefined });
  });

  it("creates a location from the body", async () => {
    const dto = { code: "STORE-3", name: "Karen Showroom", type: LocationType.STORE };
    await controller.create(dto);
    expect(locations.create).toHaveBeenCalledWith(dto);
  });

  it("finds one location by code", async () => {
    await controller.findOne("STORE-1");
    expect(locations.findOne).toHaveBeenCalledWith("STORE-1");
  });

  it("updates a location by code", async () => {
    await controller.update("STORE-1", { active: false });
    expect(locations.update).toHaveBeenCalledWith("STORE-1", { active: false });
  });

  it("adds a register to a location", async () => {
    await controller.addRegister("STORE-1", { code: "REG-3", name: "Till 3" });
    expect(locations.addRegister).toHaveBeenCalledWith("STORE-1", { code: "REG-3", name: "Till 3" });
  });
});
