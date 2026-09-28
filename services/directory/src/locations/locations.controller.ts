import { Body, Controller, Get, Param, ParseBoolPipe, ParseEnumPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { LocationType } from "../generated/prisma";
import { CreateLocationDto } from "./dto/create-location.dto";
import { CreateRegisterDto } from "./dto/create-register.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationsService } from "./locations.service";

@ApiTags("locations")
@Controller("locations")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @ApiQuery({ name: "type", enum: LocationType, required: false })
  @ApiQuery({ name: "includeInactive", type: Boolean, required: false })
  list(
    @Query("type", new ParseEnumPipe(LocationType, { optional: true })) type?: LocationType,
    @Query("includeInactive", new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ) {
    return this.locations.list({ type, includeInactive });
  }

  @Post()
  create(@Body() dto: CreateLocationDto) {
    return this.locations.create(dto);
  }

  @Get(":code")
  findOne(@Param("code") code: string) {
    return this.locations.findOne(code);
  }

  @Patch(":code")
  update(@Param("code") code: string, @Body() dto: UpdateLocationDto) {
    return this.locations.update(code, dto);
  }

  @Post(":code/registers")
  addRegister(@Param("code") code: string, @Body() dto: CreateRegisterDto) {
    return this.locations.addRegister(code, dto);
  }
}
