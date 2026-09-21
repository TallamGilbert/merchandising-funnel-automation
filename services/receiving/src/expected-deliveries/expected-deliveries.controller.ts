import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ExpectedDeliveryStatus } from "../generated/prisma";
import { ExpectedDeliveriesService } from "./expected-deliveries.service";

@ApiTags("expected-deliveries")
@Controller()
export class ExpectedDeliveriesController {
  constructor(private readonly expectedDeliveries: ExpectedDeliveriesService) {}

  @Get("expected-deliveries")
  list(@Query("status") status?: ExpectedDeliveryStatus) {
    return this.expectedDeliveries.list(status);
  }

  @Get("expected-deliveries/:poNumber")
  findOne(@Param("poNumber") poNumber: string) {
    return this.expectedDeliveries.findByPoNumber(poNumber);
  }
}
