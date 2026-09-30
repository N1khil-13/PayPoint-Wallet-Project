const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');

router.post('/', userController.createUser);

router.get('/:id', userController.getUser);

router.get(
    '/:id/wallet',
    userController.getWallet
);

module.exports = router;