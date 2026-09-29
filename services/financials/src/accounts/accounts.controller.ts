import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AccountsService } from "./accounts.service";

@ApiTags("accounts")
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list() {
    return this.accounts.list();
  }
}
