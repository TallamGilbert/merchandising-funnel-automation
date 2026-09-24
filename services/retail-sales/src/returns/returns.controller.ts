import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateReturnDto } from "./dto/create-return.dto";
import { ReturnsService } from "./returns.service";

@ApiTags("returns")
@Controller("returns")
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  process(@Body() dto: CreateReturnDto) {
    return this.returns.processReturn(dto);
  }
}
