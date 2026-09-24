import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CheckoutDto } from "./dto/checkout.dto";
import { CheckoutService } from "./checkout.service";

@ApiTags("checkout")
@Controller()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post("checkout")
  process(@Body() dto: CheckoutDto) {
    return this.checkout.checkout(dto);
  }
}
