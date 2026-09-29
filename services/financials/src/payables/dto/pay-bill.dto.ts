import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class PayBillDto {
  @ApiPropertyOptional({ example: "MPESA-QX81K2", description: "Bank or M-Pesa reference" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentReference?: string;

  @ApiPropertyOptional({ example: "2026-09-29", description: "Defaults to today" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "paidOn must be a date (YYYY-MM-DD)" })
  paidOn?: string;
}
