import { BadRequestException, Body, Controller, Get, Param, ParseBoolPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { StaffRole } from "../generated/prisma";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { StaffService } from "./staff.service";

@ApiTags("staff")
@Controller("staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiQuery({ name: "role", required: false, description: "One role, or several comma-separated (MANAGER,OWNER)" })
  @ApiQuery({ name: "locationCode", required: false })
  @ApiQuery({ name: "includeInactive", type: Boolean, required: false })
  list(
    @Query("role") role?: string,
    @Query("locationCode") locationCode?: string,
    @Query("includeInactive", new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ) {
    return this.staff.list({ roles: parseRoles(role), locationCode, includeInactive });
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.staff.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(id, dto);
  }
}

function parseRoles(raw?: string): StaffRole[] | undefined {
  if (!raw) return undefined;
  const roles = raw.split(",").map((r) => r.trim().toUpperCase());
  const valid = Object.values(StaffRole) as string[];
  const unknown = roles.filter((r) => !valid.includes(r));
  if (unknown.length) {
    throw new BadRequestException(`Unknown role(s): ${unknown.join(", ")}. Expected one of ${valid.join(", ")}`);
  }
  return roles as StaffRole[];
}
