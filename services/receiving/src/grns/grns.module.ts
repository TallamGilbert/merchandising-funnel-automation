import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { ExpectedDeliveriesModule } from "../expected-deliveries/expected-deliveries.module";
import { ProcurementClientModule } from "../procurement-client/procurement-client.module";
import { GrnsController } from "./grns.controller";
import { GrnsService } from "./grns.service";

@Module({
  imports: [ExpectedDeliveriesModule, ProcurementClientModule, EventBusModule],
  controllers: [GrnsController],
  providers: [GrnsService],
})
export class GrnsModule {}
