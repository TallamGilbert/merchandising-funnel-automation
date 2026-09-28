import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { StaffController } from "./staff.controller";
import { StaffRepository } from "./staff.repository";
import { StaffService } from "./staff.service";

@Module({
  imports: [LocationsModule],
  controllers: [StaffController],
  providers: [StaffService, StaffRepository],
  exports: [StaffRepository],
})
export class StaffModule {}
