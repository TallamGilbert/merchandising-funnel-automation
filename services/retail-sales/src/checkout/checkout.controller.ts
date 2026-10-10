import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Role, Roles } from "@mms/shared";
import { CheckoutDto } from "./dto/checkout.dto";
import { CheckoutService } from "./checkout.service";

@ApiTags("checkout")
@Controller()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post("checkout")
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  process(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.checkout.checkout({ ...dto, cashierId: user.id });
  }
}
