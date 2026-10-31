import { Module } from "@nestjs/common";
import { LocationActivityClient } from "./location-activity.client";
import { LocationsController } from "./locations.controller";
import { LocationsRepository } from "./locations.repository";
import { LocationsService } from "./locations.service";

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, LocationsRepository, LocationActivityClient],
  exports: [LocationsService, LocationsRepository],
})
export class LocationsModule {}
