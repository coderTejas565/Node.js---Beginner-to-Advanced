import { prisma } from "./prisma-client.ts";

async function createOrder(
  userId: number,
  productId: number,
  quantity: number
) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.products.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.stock_quantity < quantity) {
      throw new Error("Insufficient stock");
    }

    const order = await tx.orders.create({
      data: {
        user_id: userId,
        status: "pending",
      },
    });

    await tx.order_items.create({
      data: {
        order_id: order.id,
        product_id: productId,
        quantity,
        price_paise: product.price_paise,
      },
    });

    const updated = await tx.products.updateMany({
      where: {
        id: productId,
        stock_quantity: { gte: quantity },
      },
      data: {
        stock_quantity: { decrement: quantity },
      },
    });

    if (updated.count !== 1) {
      throw new Error("Insufficient stock");
    }

    return order;
  });
}

try {
  const order = await createOrder(2, 1, 2);
  console.log("Order created:", order);
} catch (error) {
  if (error instanceof Error) {
    console.error("Order failed:", error.message);
  } else {
    console.error("Order failed:", error);
  }
}finally {
  await prisma.$disconnect();
}