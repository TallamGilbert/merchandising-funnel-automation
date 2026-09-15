import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { isModuleEnabled } from "./feature-flags";
import { ModuleKey } from "./module-phase";

/**
 * Applied globally (`app.useGlobalGuards(...)`) in each service's
 * `main.ts`. Lets `/health` through unconditionally so orchestration/
 * monitoring can always see the container is up; every other route 503s
 * with a "not yet implemented" body when the module's phase flag is off.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly moduleKey: ModuleKey) {}

  static forModule(moduleKey: ModuleKey): FeatureFlagGuard {
    return new FeatureFlagGuard(moduleKey);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ path?: string; url?: string }>();
    const path = request.path ?? request.url ?? "";

    if (path.startsWith("/health")) return true;
    if (isModuleEnabled(this.moduleKey)) return true;

    throw new ServiceUnavailableException({
      statusCode: 503,
      error: "Not Yet Implemented",
      message: `The '${this.moduleKey}' module is disabled for this phase. Enable it via its feature flag when ready.`,
      moduleKey: this.moduleKey,
    });
  }
}
