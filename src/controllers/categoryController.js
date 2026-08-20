const prisma = require('../utils/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { createCategorySchema } = require('../validations/categoryValidation');

const categoryController = {
  createCategory: catchAsync(async (req, res, next) => {
    // 1. Validate request body
    const validatedData = createCategorySchema.parse(req.body);
    const { name } = validatedData;

    // 2. Check if category name already exists
    const existingCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: name,
        },
      },
    });

    if (existingCategory) {
      throw new AppError(`Kategoriya '${name}' allaqachon mavjud`, 400);
    }

    // 3. Create category in database
    const category = await prisma.category.create({
      data: validatedData,
    });

    // 4. Send response
    res.status(201).json({
      status: 'success',
      data: {
        category,
      },
    });
  }),

  getAllCategories: catchAsync(async (req, res, next) => {
    // 1. Retrieve all categories ordered by name ascending
    const categories = await prisma.category.findMany({
      where: {
        isDeleted: false,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 2. Send response
    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: {
        categories,
      },
    });
  }),

  deleteCategory: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new AppError('Kategoriya topilmadi', 404);
    }

    // Soft delete
    await prisma.category.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        name: `${category.name}_deleted_${Date.now()}`,
      },
    });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  }),
};

module.exports = categoryController;
