import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { isModuleEnabled, ModuleKey } from "@mms/shared";
import { LocationType } from "../generated/prisma";
import { CreateLocationDto } from "./dto/create-location.dto";
import { CreateRegisterDto } from "./dto/create-register.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationActivityClient } from "./location-activity.client";
import { LocationFilter, LocationsRepository } from "./locations.repository";

export type DeactivationIssueKind =
  | "STOCK_ON_HAND"
  | "OPEN_BUSINESS_DAYS"
  | "STAFF_ASSIGNED"
  | "TRANSFERS_IN_PROGRESS"
  | "DELIVERIES_IN_PROGRESS"
  | "CHECK_FAILED";

export interface DeactivationIssue {
  kind: DeactivationIssueKind;
  message: string;
}

/** Blockers stop the deactivation; warnings are shown for the manager to confirm past. */
export interface DeactivationCheck {
  blockers: DeactivationIssue[];
  warnings: DeactivationIssue[];
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

@Injectable()
export class LocationsService {
  constructor(
    private readonly locations: LocationsRepository,
    private readonly activity: LocationActivityClient,
  ) {}

  list(filter: LocationFilter) {
    return this.locations.findAll(filter);
  }

  async findOne(code: string) {
    const location = await this.locations.findByCode(code);
    if (!location) throw new NotFoundException(`Location ${code} not found`);
    return location;
  }

  async create(dto: CreateLocationDto) {
    if (await this.locations.findByCode(dto.code)) {
      throw new ConflictException(`Location ${dto.code} already exists`);
    }
    return this.locations.create(dto);
  }

  async update(code: string, dto: UpdateLocationDto) {
    const location = await this.findOne(code);
    if (dto.active === false && location.active) {
      const { blockers } = await this.deactivationCheck(code);
      if (blockers.length) {
        throw new ConflictException({
          statusCode: 409,
          error: "Conflict",
          message: `${code} can't be deactivated yet: ${blockers.map((b) => b.message).join("; ")}`,
          blockers,
        });
      }
    }
    return this.locations.update(code, dto);
  }

  /**
   * What deactivating would leave stranded. Stock still on hand and (for a
   * store) unclosed business days block it; staff, transfers and deliveries
   * still pointing at it only warn. A blocking check that can't reach its
   * service blocks too — deactivation fails closed. Modules that are switched
   * off can't hold anything here, so they're skipped.
   */
  async deactivationCheck(code: string): Promise<DeactivationCheck> {
    const location = await this.findOne(code);
    const blockers: DeactivationIssue[] = [];
    const warnings: DeactivationIssue[] = [];
    const unreachable = (what: string, service: string) => ({
      kind: "CHECK_FAILED" as const,
      message: `Couldn't check ${what} — ${service} is unreachable`,
    });

    await Promise.all([
      isModuleEnabled(ModuleKey.INVENTORY) &&
        this.activity.stockOnHand(code).then(
          ({ skusOnHand, unitsOnHand }) => {
            if (unitsOnHand > 0) {
              blockers.push({
                kind: "STOCK_ON_HAND",
                message: `${plural(unitsOnHand, "unit")} of ${plural(skusOnHand, "product")} still on hand — transfer or adjust it out first`,
              });
            }
          },
          () => blockers.push(unreachable("stock on hand", "Inventory")),
        ),
      location.type === LocationType.STORE &&
        isModuleEnabled(ModuleKey.SALES_AUDIT) &&
        this.activity.unclosedBusinessDates(code).then(
          (dates) => {
            if (dates.length) {
              blockers.push({
                kind: "OPEN_BUSINESS_DAYS",
                message: `${plural(dates.length, "business day")} not closed yet (${dates.join(", ")}) — close them first`,
              });
            }
          },
          () => blockers.push(unreachable("open business days", "Sales Audit")),
        ),
      this.locations.countActiveStaff(code).then((n) => {
        if (n) {
          warnings.push({
            kind: "STAFF_ASSIGNED",
            message: `${plural(n, "active staff member")} still assigned here — move them on the Staff page`,
          });
        }
      }),
      isModuleEnabled(ModuleKey.WAREHOUSE_OPERATIONS) &&
        this.activity.transfersInProgress(code).then(
          (n) => {
            if (n) warnings.push({ kind: "TRANSFERS_IN_PROGRESS", message: `${plural(n, "transfer")} to or from here still being picked` });
          },
          () => warnings.push(unreachable("transfers", "Warehouse Operations")),
        ),
      isModuleEnabled(ModuleKey.RECEIVING) &&
        this.activity.draftGoodsReceivedNotes(code).then(
          (n) => {
            if (n) warnings.push({ kind: "DELIVERIES_IN_PROGRESS", message: `${plural(n, "delivery", "deliveries")} still being received here (draft GRNs)` });
          },
          () => warnings.push(unreachable("deliveries", "Receiving")),
        ),
    ]);

    return { blockers, warnings };
  }

  /** Registers are tills, so they only exist in stores. */
  async addRegister(locationCode: string, dto: CreateRegisterDto) {
    const location = await this.findOne(locationCode);
    if (location.type !== LocationType.STORE) {
      throw new BadRequestException(`${locationCode} is a ${location.type.toLowerCase()}, not a store`);
    }
    if (await this.locations.findRegister(locationCode, dto.code)) {
      throw new ConflictException(`${locationCode} already has a register ${dto.code}`);
    }
    return this.locations.createRegister({ locationCode, code: dto.code, name: dto.name });
  }
}
