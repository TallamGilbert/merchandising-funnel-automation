import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "../auth.guard";
import { AllowPendingPasswordChange, Public, Roles } from "../decorators";
import { Role } from "../roles";
import { AuthUser, serviceToken, SESSION_COOKIE, signSessionToken } from "../session-token";

class TestController {
  open() {}
  @Public() login() {}
  @Roles(Role.OWNER, Role.MANAGER) approve() {}
  @AllowPendingPasswordChange() changePassword() {}
}

@Roles(Role.ACCOUNTANT)
class FinanceController {
  read() {}
  @Roles(Role.OWNER) ownerOnly() {}
}

const cashier: AuthUser = {
  id: "cashier-amy",
  name: "Amy",
  role: Role.CASHIER,
  locationCode: "STORE-1",
  mustChangePassword: false,
  sessionVersion: 0,
};

function context(
  controller: object,
  handler: string,
  headers: Record<string, string> = {},
  path = "/things",
): { ctx: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { path, headers };
  const ctx = {
    getType: () => "http",
    getHandler: () => (controller as Record<string, unknown>)[handler],
    getClass: () => controller.constructor,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

const bearer = (user: AuthUser) => ({ authorization: `Bearer ${signSessionToken(user)}` });

describe("AuthGuard", () => {
  const guard = new AuthGuard(new Reflector());
  const controller = new TestController();
  const finance = new FinanceController();

  it("lets /health through without a session", () => {
    expect(guard.canActivate(context(controller, "open", {}, "/health").ctx)).toBe(true);
  });

  it("lets @Public routes through without a session", () => {
    expect(guard.canActivate(context(controller, "login").ctx)).toBe(true);
  });

  it("401s without a token", () => {
    expect(() => guard.canActivate(context(controller, "open").ctx)).toThrow(UnauthorizedException);
  });

  it("401s with a bad token", () => {
    const { ctx } = context(controller, "open", { authorization: "Bearer nope" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("accepts the session cookie and attaches the user", () => {
    const token = signSessionToken(cashier);
    const { ctx, request } = context(controller, "open", {
      cookie: `theme=dark; ${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user).toEqual(cashier);
  });

  it("allows any signed-in role when the route names none", () => {
    expect(guard.canActivate(context(controller, "open", bearer(cashier)).ctx)).toBe(true);
  });

  it("403s a role the route does not allow", () => {
    const { ctx } = context(controller, "approve", bearer(cashier));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("allows a listed role", () => {
    const manager = { ...cashier, role: Role.MANAGER };
    expect(guard.canActivate(context(controller, "approve", bearer(manager)).ctx)).toBe(true);
  });

  it("applies class-level roles, with method-level overriding them", () => {
    const accountant = { ...cashier, role: Role.ACCOUNTANT };
    expect(guard.canActivate(context(finance, "read", bearer(accountant)).ctx)).toBe(true);
    expect(() => guard.canActivate(context(finance, "read", bearer(cashier)).ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context(finance, "ownerOnly", bearer(accountant)).ctx)).toThrow(
      ForbiddenException,
    );
  });

  it("lets a SERVICE token past role checks", () => {
    const { ctx } = context(finance, "ownerOnly", { authorization: `Bearer ${serviceToken()}` });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("only allows the password change while one is pending", () => {
    const pending = bearer({ ...cashier, mustChangePassword: true });
    expect(() => guard.canActivate(context(controller, "open", pending).ctx)).toThrow(ForbiddenException);
    expect(guard.canActivate(context(controller, "changePassword", pending).ctx)).toBe(true);
  });

  it("does not guard non-HTTP contexts (Inventory's internal gRPC)", () => {
    const ctx = { getType: () => "rpc" } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
