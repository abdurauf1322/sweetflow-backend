const supplierService = require('../services/supplierService');

const supplierController = {
  async getAllSuppliers(req, res, next) {
    try {
      const suppliers = await supplierService.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      next(error);
    }
  },

  async createSupplier(req, res, next) {
    try {
      const supplier = await supplierService.createSupplier(req.body);
      res.status(201).json(supplier);
    } catch (error) {
      next(error);
    }
  },

  async getSupplierDebts(req, res, next) {
    try {
      const debts = await supplierService.getSupplierDebts();
      res.json(debts);
    } catch (error) {
      next(error);
    }
  },

  async paySupplierDebt(req, res, next) {
    try {
      const { id } = req.params;
      const { amount, productId } = req.body;
      const result = await supplierService.paySupplierDebt(id, amount, productId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = supplierController;
