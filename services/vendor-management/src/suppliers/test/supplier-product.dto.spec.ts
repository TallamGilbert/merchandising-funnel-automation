import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateSupplierProductDto } from "../dto/create-supplier-product.dto";
import { UpdateSupplierProductDto } from "../dto/update-supplier-product.dto";

async function currencyErrors<T extends object>(cls: new () => T, body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors.filter((e) => e.property === "currency").flatMap((e) => Object.values(e.constraints ?? {}));
}

describe("supplier product currency validation", () => {
  const product = { sku: "CHAIR-OAK-01", productName: "Oak Chair", unitCost: 2999.99 };

  it.each(["KES", "USD", "EUR", "GBP"])("accepts %s", async (currency) => {
    expect(await currencyErrors(CreateSupplierProductDto, { ...product, currency })).toEqual([]);
  });

  it.each(["kes", "KES 100", "Shillings", ""])("rejects %p on create", async (currency) => {
    expect(await currencyErrors(CreateSupplierProductDto, { ...product, currency })).toEqual([
      "currency must be one of KES, USD, EUR, GBP",
    ]);
  });

  it("rejects an unsupported currency on update", async () => {
    expect(await currencyErrors(UpdateSupplierProductDto, { currency: "JPY" })).toHaveLength(1);
  });

  it("allows an update that leaves the currency alone", async () => {
    expect(await currencyErrors(UpdateSupplierProductDto, { unitCost: 10 })).toEqual([]);
  });
});
