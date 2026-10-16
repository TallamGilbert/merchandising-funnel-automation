import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ALLOW_PENDING_PASSWORD_KEY, IS_PUBLIC_KEY, ROLES_KEY } from "./decorators";
import { Role, SERVICE_ROLE } from "./roles";
import { AuthUser, SESSION_COOKIE, verifySessionToken } from "./session-token";

interface HttpRequest {
  path?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

/**
 * Applied globally in each service's `main.ts`, after the FeatureFlagGuard.
 * Accepts the session cookie (browsers) or a Bearer token (service calls,
 * scripts). Only guards HTTP — Inventory's gRPC port is internal-only.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const path = request.path ?? request.url ?? "";
    if (path.startsWith("/health") || this.flag(context, IS_PUBLIC_KEY)) return true;

    const token = readToken(request);
    const user = token ? verifySessionToken(token) : null;
    if (!user) throw new UnauthorizedException("Sign in to continue");
    request.user = user;

    if (user.role === SERVICE_ROLE) return true;

    if (user.mustChangePassword && !this.flag(context, ALLOW_PENDING_PASSWORD_KEY)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: "Password Change Required",
        message: "Choose a new password before continuing",
      });
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException(`This action needs one of these roles: ${roles.join(", ")}`);
    }
    return true;
  }

  private flag(context: ExecutionContext, key: string): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]),
    );
  }
}

function readToken(request: HttpRequest): string | undefined {
  const auth = request.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7).trim();

  const cookie = request.headers.cookie;
  if (typeof cookie !== "string") return undefined;
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}
