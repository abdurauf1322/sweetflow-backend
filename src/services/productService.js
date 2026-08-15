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

    return prisma.$transaction(async (tx) => {
      const product = await productRepository.create(productData, tx);

      // Deduct cost: boxes × boxCostPrice + pieces × costPrice
      const initBoxes  = Number(productData._addedBoxes  || 0);
      const initPieces = Number(productData._addedPieces || 0);
      const pieceCost  = Number(product.costPrice    || 0);
      const boxCost    = Number(product.boxCostPrice || 0);
      const totalCost  = (initBoxes * boxCost) + (initPieces * pieceCost);

      if (totalCost > 0) {
        const balanceService = require('./balanceService');
        await balanceService.updateBalance(-totalCost, tx);

        await tx.purchaseHistory.create({
          data: {
            productId: product.id,
            addedBoxes: initBoxes,
            addedPieces: initPieces,
            boxCostPrice: boxCost,
            pieceCostPrice: pieceCost,
            totalCost: totalCost
          }
        });
      }
      return product;
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

    return prisma.$transaction(async (tx) => {
      // 2. Verify product exists
      const product = await productRepository.findById(id, tx);
      if (!product) {
        throw new AppError(`Product with ID ${id} not found`, 404);
      }

      // 3. Verify name uniqueness if name is changed
      if (name !== product.name) {
        const existingProduct = await productRepository.findByName(name, tx);
        if (existingProduct) {
          throw new AppError(`Product with name '${name}' already exists`, 400);
        }
      }

      const oldStock   = Number(product.stockCount || 0);
      const pieceCost  = Number(productData.costPrice    !== undefined ? productData.costPrice    : product.costPrice);
      const boxCost    = Number(productData.boxCostPrice !== undefined ? productData.boxCostPrice : product.boxCostPrice);
      const qtyInBox   = Number(productData.quantityInBox !== undefined ? productData.quantityInBox : product.quantityInBox) || 1;

      // Added boxes and pieces from the incoming form values
      const addedBoxes  = Number(productData._addedBoxes  || 0);
      const addedPieces = Number(productData._addedPieces || 0);

      const newStock = oldStock + addedPieces + (addedBoxes * qtyInBox);

      // 4. Perform update — only pass fields that Prisma knows about
      const cleanData = {
        name:          productData.name,
        categoryId:    productData.categoryId,
        unitPrice:     productData.unitPrice,
        boxPrice:      productData.boxPrice,
        costPrice:     productData.costPrice,
        boxCostPrice:  productData.boxCostPrice,
        quantityInBox: productData.quantityInBox,
        stockCount:    newStock,
        minStockLimit: productData.minStockLimit,
        imageUrl:      productData.imageUrl !== undefined ? productData.imageUrl : product.imageUrl,
      };
      // Drop any undefined entries so Prisma doesn't try to set them to null
      Object.keys(cleanData).forEach(k => cleanData[k] === undefined && delete cleanData[k]);

      const updatedProduct = await tx.product.update({
        where: { id },
        data: cleanData,
        include: { category: true },
      });

      // 5. Deduct cost from balance only when new goods are explicitly added
      // _addedBoxes / _addedPieces are set by the controller from form input
      if (addedBoxes > 0 || addedPieces > 0) {
        const totalCost = (addedBoxes * boxCost) + (addedPieces * pieceCost);
        if (totalCost > 0) {
          const balanceService = require('./balanceService');
          await balanceService.updateBalance(-totalCost, tx);

          await tx.purchaseHistory.create({
            data: {
              productId: product.id,
              addedBoxes: addedBoxes,
              addedPieces: addedPieces,
              boxCostPrice: boxCost,
              pieceCostPrice: pieceCost,
              totalCost: totalCost
            }
          });
        }
      }

      return updatedProduct;
    });
  },

  async getLowStockProducts() {
    return productRepository.findLowStock();
  },
};

module.exports = productService;
