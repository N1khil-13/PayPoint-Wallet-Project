const express = require('express');
const router = express.Router();

const walletController = require('../controllers/walletController');

router.get('/:id', walletController.getWallet);
router.post('/:id/deposit', walletController.deposit);
router.get('/:id/transactions', walletController.getTransactions);

module.exports = router;