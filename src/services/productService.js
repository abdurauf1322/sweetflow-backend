const productRepository = require('../repositories/productRepository');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

const productService = {
  async createProduct(productData) {
    const { categoryId, name } = productData;

    // 1. Verify if category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!categoryExists) {
      throw new AppError(`Category with ID ${categoryId} does not exist`, 400);
    }

    // 2. Check if product with this name already exists
    const existingProduct = await productRepository.findByName(name);
    if (existingProduct) {
      throw new AppError(`Product with name '${name}' already exists`, 400);
    }

    return productRepository.create({
      ...productData,
    });
  },

  async getAllProducts() {
    return prisma.product.findMany({
      where: {
        isDeleted: false,
      },
      include: {
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  },

  async deleteProduct(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(`Product with ID ${id} not found`, 404);
    }

    // 1. Check if product has historical order items
    const orderItemCount = await prisma.supplyOrderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      // Soft delete: flag and rename name to release unique index
      return prisma.product.update({
        where: { id },
        data: {
          isDeleted: true,
          name: `${product.name}_deleted_${Date.now()}`,
        },
      });
    } else {
      // Hard delete
      return prisma.product.delete({
        where: { id },
      });
    }
  },

  async updateProduct(id, productData) {
    const { categoryId, name } = productData;

    // 1. Verify category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!categoryExists) {
      throw new AppError(`Category with ID ${categoryId} does not exist`, 400);
    }

    // 2. Verify product exists
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(`Product with ID ${id} not found`, 404);
    }

    // 3. Verify name uniqueness if name is changed
    if (name !== product.name) {
      const existingProduct = await productRepository.findByName(name);
      if (existingProduct) {
        throw new AppError(`Product with name '${name}' already exists`, 400);
      }
    }

    // 4. Perform update
    return prisma.product.update({
      where: { id },
      data: productData,
      include: {
        category: true,
      }
    });
  },

  async getLowStockProducts() {
    return productRepository.findLowStock();
  },
};

module.exports = productService;
