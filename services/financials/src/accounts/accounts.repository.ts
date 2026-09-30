import { Injectable } from "@nestjs/common";
import { AccountType } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.account.findMany({ orderBy: { code: "asc" } });
  }

  /** Creates missing accounts and keeps names/types in step with the code. */
  async upsertMany(accounts: { code: string; name: string; type: AccountType }[]) {
    await this.prisma.$transaction(
      accounts.map((a) =>
        this.prisma.account.upsert({
          where: { code: a.code },
          create: a,
          update: { name: a.name, type: a.type },
        }),
      ),
    );
  }
}
