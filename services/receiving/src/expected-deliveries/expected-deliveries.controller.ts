import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Exportable } from "@mms/shared";
import { ExpectedDelivery } from "../generated/prisma";
import { ExpectedDeliveriesService } from "./expected-deliveries.service";
import { ListExpectedDeliveriesQuery } from "./list-expected-deliveries.query";

@ApiTags("expected-deliveries")
@Controller()
export class ExpectedDeliveriesController {
  constructor(private readonly expectedDeliveries: ExpectedDeliveriesService) {}

  @Get("expected-deliveries")
  @Exportable<ExpectedDelivery>("expected-deliveries", [
    { header: "PO number", value: (d) => d.poNumber },
    { header: "Supplier", value: (d) => d.supplierName },
    { header: "Status", value: (d) => d.status },
    { header: "Expected since", value: (d) => d.createdAt },
  ])
  list(@Query() query: ListExpectedDeliveriesQuery) {
    return this.expectedDeliveries.list(query);
  }

  @Get("expected-deliveries/:poNumber")
  findOne(@Param("poNumber") poNumber: string) {
    return this.expectedDeliveries.findByPoNumber(poNumber);
  }
}
