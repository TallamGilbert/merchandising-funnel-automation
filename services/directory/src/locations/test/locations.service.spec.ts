import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { LocationType } from "../../generated/prisma";
import { LocationsRepository } from "../locations.repository";
import { LocationsService } from "../locations.service";

describe("LocationsService", () => {
  let service: LocationsService;
  let locations: Record<
    "findAll" | "findByCode" | "create" | "update" | "findRegister" | "createRegister",
    jest.Mock
  >;

  const store = { code: "STORE-1", name: "Westlands Showroom", type: LocationType.STORE, registers: [] };
  const warehouse = { code: "WH-01", name: "Main Warehouse", type: LocationType.WAREHOUSE, registers: [] };

  beforeEach(() => {
    locations = {
      findAll: jest.fn().mockResolvedValue([store, warehouse]),
      findByCode: jest.fn().mockResolvedValue(store),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue(store),
      findRegister: jest.fn().mockResolvedValue(null),
      createRegister: jest.fn().mockImplementation((data) => Promise.resolve({ id: "reg-id", ...data })),
    };
    service = new LocationsService(locations as unknown as LocationsRepository);
  });

  it("passes the filter through when listing", async () => {
    await service.list({ type: LocationType.STORE });
    expect(locations.findAll).toHaveBeenCalledWith({ type: LocationType.STORE });
  });

  it("rejects an unknown location code", async () => {
    locations.findByCode.mockResolvedValue(null);
    await expect(service.findOne("NOPE")).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("create", () => {
    const dto = { code: "STORE-3", name: "Karen Showroom", type: LocationType.STORE };

    it("creates a new location", async () => {
      locations.findByCode.mockResolvedValue(null);
      await expect(service.create(dto)).resolves.toEqual(dto);
    });

    it("rejects a duplicate code without writing", async () => {
      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(locations.create).not.toHaveBeenCalled();
    });
  });

  it("updates an existing location", async () => {
    await service.update("STORE-1", { name: "Westlands Flagship" });
    expect(locations.update).toHaveBeenCalledWith("STORE-1", { name: "Westlands Flagship" });
  });

  describe("addRegister", () => {
    it("adds a register to a store", async () => {
      const register = await service.addRegister("STORE-1", { code: "REG-3", name: "Till 3" });

      expect(locations.createRegister).toHaveBeenCalledWith({ locationCode: "STORE-1", code: "REG-3", name: "Till 3" });
      expect(register).toEqual(expect.objectContaining({ code: "REG-3" }));
    });

    it("rejects a register on a warehouse", async () => {
      locations.findByCode.mockResolvedValue(warehouse);

      await expect(service.addRegister("WH-01", { code: "REG-1", name: "Till" })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(locations.createRegister).not.toHaveBeenCalled();
    });

    it("rejects a register code already used in that store", async () => {
      locations.findRegister.mockResolvedValue({ id: "existing" });

      await expect(service.addRegister("STORE-1", { code: "REG-1", name: "Till" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
