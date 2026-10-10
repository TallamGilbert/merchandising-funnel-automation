import { Body, Controller, Get, HttpCode, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  AllowPendingPasswordChange,
  AuthUser,
  CurrentUser,
  Public,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSessionToken,
} from "@mms/shared";
import type { CookieOptions, Response } from "express";
import { AuthService } from "./auth.service";
import { ChangePasswordDto, LoginDto } from "./dto/login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Public()
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    const user = await this.auth.login(dto.staffId, dto.password);
    setSessionCookie(res, user);
    return user;
  }

  @Post("logout")
  @Public()
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  }

  /** Who is signed in. Also extends the session, so an app left open stays signed in. */
  @Get("me")
  @AllowPendingPasswordChange()
  async me(@CurrentUser() session: AuthUser, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    const user = await this.auth.me(session);
    setSessionCookie(res, user);
    return user;
  }

  @Post("change-password")
  @AllowPendingPasswordChange()
  @HttpCode(200)
  async changePassword(
    @CurrentUser() session: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const user = await this.auth.changePassword(session, dto.currentPassword, dto.newPassword);
    setSessionCookie(res, user);
    return user;
  }
}

/**
 * One cookie for every app and API: COOKIE_DOMAIN is the parent domain in
 * production (e.g. `.example.com`); unset locally, where cookies are shared
 * across localhost ports anyway. Secure unless COOKIE_SECURE=false (plain
 * http in local Docker).
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE !== "false",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

function setSessionCookie(res: Response, user: AuthUser): void {
  res.cookie(SESSION_COOKIE, signSessionToken(user), cookieOptions());
}
