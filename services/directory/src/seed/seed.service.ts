import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { isFeatureEnabled } from "@mms/shared";
import { DEMO_DIRECTORY } from "./demo-directory";
import { SeedRepository } from "./seed.repository";

/**
 * Seeds the demo directory once, on a fresh database only — never touches
 * a directory that already has data. Disable with DIRECTORY_SEED_DEMO=false.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly seed: SeedRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedDemoIfEmpty();
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
}
