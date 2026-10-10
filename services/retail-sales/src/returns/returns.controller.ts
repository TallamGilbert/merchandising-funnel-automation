import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role, Roles } from "@mms/shared";
import { CreateReturnDto } from "./dto/create-return.dto";
import { ReturnsService } from "./returns.service";

@ApiTags("returns")
@Controller("returns")
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  process(@Body() dto: CreateReturnDto) {
    return this.returns.processReturn(dto);
  }
}
