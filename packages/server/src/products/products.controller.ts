import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { schemas, UserRole, type ProductInput } from "@snackmanager/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { Roles } from "../common/decorators";
import { ProductsService } from "./products.service";

const productPatchSchema = schemas.productInputSchema.partial();

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query("all") all?: string) {
    return this.products.list(all === "1" || all === "true");
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body(new ZodBody(schemas.productInputSchema)) dto: ProductInput) {
    return this.products.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodBody(productPatchSchema)) dto: Partial<ProductInput>,
  ) {
    return this.products.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.products.remove(id);
  }
}
