import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { LocationsRepository } from "../locations/locations.repository";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { StaffFilter, StaffRepository } from "./staff.repository";

@Injectable()
export class StaffService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly locations: LocationsRepository,
  ) {}

  list(filter: StaffFilter) {
    return this.staff.findAll(filter);
  }

  async findOne(id: string) {
    const person = await this.staff.findById(id);
    if (!person) throw new NotFoundException(`Staff member ${id} not found`);
    return person;
  }

  async create(dto: CreateStaffDto) {
    if (await this.staff.findById(dto.id)) {
      throw new ConflictException(`Staff member ${dto.id} already exists`);
    }
    if (dto.locationCode) await this.assertLocationExists(dto.locationCode);
    return this.staff.create(dto);
  }

  /** Also how a role is changed — the dashboard's role modal sends `{ role }`. */
  async update(id: string, dto: UpdateStaffDto) {
    await this.findOne(id);
    if (dto.locationCode) await this.assertLocationExists(dto.locationCode);
    return this.staff.update(id, dto);
  }

  private async assertLocationExists(code: string) {
    if (!(await this.locations.findByCode(code))) {
      throw new BadRequestException(`Location ${code} does not exist`);
    }
  }
}
