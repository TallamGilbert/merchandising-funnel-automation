import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { isFeatureEnabled } from "@mms/shared";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../auth/password";
import { DEMO_DIRECTORY } from "./demo-directory";
import { SeedRepository } from "./seed.repository";

/**
 * Seeds the demo directory once, on a fresh database only — never touches
 * a directory that already has data. Disable with DIRECTORY_SEED_DEMO=false.
 *
 * Then makes sure someone can sign in (D-16): demo staff get
 * DEMO_STAFF_PASSWORD when it is set, and if no active owner has a password
 * yet, BOOTSTRAP_OWNER_ID / BOOTSTRAP_OWNER_PASSWORD create (or promote)
 * one. That owner must choose a new password on first sign-in.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly seed: SeedRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedDemoIfEmpty();
    await this.setDemoPasswords();
    await this.bootstrapOwner();
  }

  async seedDemoIfEmpty(): Promise<boolean> {
    if (!isFeatureEnabled("DIRECTORY_SEED_DEMO", true)) return false;
    if (!(await this.seed.isEmpty())) return false;

    await this.seed.insert(DEMO_DIRECTORY);
    this.logger.log(
      `Seeded demo directory: ${DEMO_DIRECTORY.locations.length} locations, ` +
        `${DEMO_DIRECTORY.registers.length} registers, ${DEMO_DIRECTORY.staff.length} staff`,
    );
    return true;
  }

  /** Only fills in demo staff who have no password — never overwrites a real one. */
  async setDemoPasswords(): Promise<number> {
    const password = process.env.DEMO_STAFF_PASSWORD;
    if (!password || !isFeatureEnabled("DIRECTORY_SEED_DEMO", true)) return 0;

    const ids = DEMO_DIRECTORY.staff.map((s) => s.id);
    const count = await this.seed.setPasswordWhereUnset(ids, await hashPassword(password));
    if (count) this.logger.log(`Set DEMO_STAFF_PASSWORD for ${count} demo staff`);
    return count;
  }

  async bootstrapOwner(): Promise<boolean> {
    const id = process.env.BOOTSTRAP_OWNER_ID?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
    if (!id || !password) return false;
    if (await this.seed.ownerCanSignIn()) return false;

    if (password.length < MIN_PASSWORD_LENGTH) {
      this.logger.error(`BOOTSTRAP_OWNER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters — no owner created`);
      return false;
    }
    const name = process.env.BOOTSTRAP_OWNER_NAME?.trim() || "Owner";
    await this.seed.upsertOwner(id, name, await hashPassword(password));
    this.logger.warn(`Bootstrapped owner '${id}' — sign in with BOOTSTRAP_OWNER_PASSWORD and choose a new password`);
    return true;
  }
}
