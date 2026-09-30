const walletService = require('../services/walletService');

exports.getWallet = async (req, res, next) => {
    try {
        const wallet = await walletService.getWallet(req.params.id);

        res.status(200).json(wallet);
    } catch (error) {
        next(error);
    }
};


exports.deposit = async (req, res, next) => {
    try {

        const {
            amount,
            idempotency_key
        } = req.body;

        if (amount === undefined || amount === null || Number(amount) <= 0) {

            const error = new Error(
                'Amount must be greater than zero'
            );

            error.statusCode = 400;
            error.code = 'INVALID_AMOUNT';

            throw error;
        }

        if (!idempotency_key) {

            const error = new Error(
                'Idempotency key is required'
            );

            error.statusCode = 400;
            error.code = 'IDEMPOTENCY_KEY_REQUIRED';

            throw error;
        }

        const transaction = await walletService.deposit(
            req.params.id,
            Number(amount),
            idempotency_key
        );

        res.status(201).json(transaction);

    } catch (error) {
        next(error);
    }
};


exports.getTransactions = async (req, res, next) => {
    try {

        const transactions =
            await walletService.getTransactions(req.params.id);

        res.status(200).json(transactions);

    } catch (error) {
        next(error);
    }
};