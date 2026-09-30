const express = require('express');
const router = express.Router();

const transferController = require('../controllers/transferController');

router.post('/', transferController.createTransfer);
router.get('/:id', transferController.getTransfer);

module.exports = router;