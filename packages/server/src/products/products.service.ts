import { Injectable, NotFoundException } from "@nestjs/common";
import { ServiceEvent, type ProductInput } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { toProduct } from "../common/mappers";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async list(includeInactive = false) {
    const rows = await this.prisma.product.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toProduct);
  }

  async create(input: ProductInput) {
    const p = await this.prisma.product.create({ data: input });
    this.events.emitEvent(ServiceEvent.PRODUCT_UPDATED, toProduct(p));
    return toProduct(p);
  }

  async update(id: string, patch: Partial<ProductInput>) {
    const p = await this.prisma.product.update({ where: { id }, data: patch }).catch(() => {
      throw new NotFoundException("product not found");
    });
    this.events.emitEvent(ServiceEvent.PRODUCT_UPDATED, toProduct(p));
    return toProduct(p);
  }

  async remove(id: string) {
    // Keep history intact: deactivate rather than hard-delete.
    return this.update(id, { isActive: false });
  }
}
