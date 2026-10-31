import { Module } from "@nestjs/common";
import { StaffModule } from "../staff/staff.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginThrottle } from "./login-throttle";

@Module({
  imports: [StaffModule],
  controllers: [AuthController],
  providers: [AuthService, LoginThrottle],
})
export class AuthModule {}
