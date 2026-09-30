const transferService = require('../services/transferService');

exports.createTransfer = async (req, res, next) => {
    try {

        const {
            from_user_id,
            to_user_id,
            amount,
            idempotency_key
        } = req.body;

        if (!from_user_id || !to_user_id || !amount || !idempotency_key) {
            const error = new Error(
                'from_user_id, to_user_id, amount and idempotency_key are required'
            );

            error.statusCode = 400;
            error.code = 'INVALID_REQUEST';

            throw error;
        }

        if (amount <= 0) {
            const error = new Error(
                'Amount must be greater than zero'
            );

            error.statusCode = 400;
            error.code = 'INVALID_AMOUNT';

            throw error;
        }

        if (from_user_id === to_user_id) {
            const error = new Error(
                'Sender and receiver cannot be the same'
            );

            error.statusCode = 400;
            error.code = 'SAME_USER_TRANSFER';

            throw error;
        }

        const transaction =
            await transferService.createTransfer({
                fromUserId: from_user_id,
                toUserId: to_user_id,
                amount,
                idempotencyKey: idempotency_key
            });

        res.status(201).json(transaction);

    } catch (error) {
        next(error);
    }
};


exports.getTransfer = async (req, res, next) => {
    try {

        const transaction =
            await transferService.getTransfer(req.params.id);

        res.json(transaction);

    } catch (error) {
        next(error);
    }
};