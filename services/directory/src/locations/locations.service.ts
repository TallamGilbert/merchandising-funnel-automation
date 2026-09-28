import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { LocationType } from "../generated/prisma";
import { CreateLocationDto } from "./dto/create-location.dto";
import { CreateRegisterDto } from "./dto/create-register.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationFilter, LocationsRepository } from "./locations.repository";

@Injectable()
export class LocationsService {
  constructor(private readonly locations: LocationsRepository) {}

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
    await this.findOne(code);
    return this.locations.update(code, dto);
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
