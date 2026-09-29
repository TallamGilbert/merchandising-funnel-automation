import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { AccountsRepository } from "./accounts.repository";
import { ACCOUNTS } from "./chart-of-accounts";

@Injectable()
export class AccountsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly accounts: AccountsRepository) {}

  /** Postings reference these codes, so they must exist before any event is processed. */
  async onApplicationBootstrap(): Promise<void> {
    await this.accounts.upsertMany(Object.values(ACCOUNTS));
    this.logger.log(`Chart of accounts ready (${Object.keys(ACCOUNTS).length} accounts)`);
  }

  list() {
    return this.accounts.findAll();
  }
}
