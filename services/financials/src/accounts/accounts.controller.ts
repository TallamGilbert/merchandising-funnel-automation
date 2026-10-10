import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role, Roles } from "@mms/shared";
import { AccountsService } from "./accounts.service";

@ApiTags("accounts")
@Roles(Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list() {
    return this.accounts.list();
  }
}
