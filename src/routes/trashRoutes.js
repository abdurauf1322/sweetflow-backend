const express = require('express');
const trashController = require('../controllers/trashController');

const router = express.Router();

router.get('/', trashController.getTrashItems);
router.post('/restore/:type/:id', trashController.restoreItem);
router.delete('/hard-delete/:type/:id', trashController.hardDeleteItem);

module.exports = router;
