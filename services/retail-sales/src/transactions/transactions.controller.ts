import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TransactionsService } from "./transactions.service";

@ApiTags("transactions")
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.transactions.findOne(id);
  }
}
