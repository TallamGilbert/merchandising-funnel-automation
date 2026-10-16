import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { Role } from "./roles";
import { AuthUser } from "./session-token";

export const IS_PUBLIC_KEY = "mms:isPublic";
export const ROLES_KEY = "mms:roles";
export const ALLOW_PENDING_PASSWORD_KEY = "mms:allowPendingPassword";

/** No session required (login). `/health` is always public. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Only these roles may call the route (or every route of the controller).
 * Without it, any signed-in staff member may. Method-level wins over class.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Reachable while the user still has to replace a temporary password. */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);

/** The signed-in user the AuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
