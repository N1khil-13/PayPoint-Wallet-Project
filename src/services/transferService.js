const { randomUUID } = require('crypto');
const pool = require('../db/db');


exports.createTransfer = async ({
    fromUserId,
    toUserId,
    amount,
    idempotencyKey
}) => {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');


        // --------------------------------------------------
        // 1. Check idempotency
        // --------------------------------------------------

        const existing = await client.query(
            `
            SELECT *
            FROM transactions
            WHERE idempotency_key = $1
            `,
            [idempotencyKey]
        );

        if (existing.rows.length > 0) {

            const transaction = existing.rows[0];

            if (
                Number(transaction.amount) !== Number(amount)
            ) {
                const error = new Error(
                    'Idempotency key was already used with a different request'
                );

                error.statusCode = 409;
                error.code = 'IDEMPOTENCY_KEY_REUSED';

                throw error;
            }

            await client.query('COMMIT');

            return transaction;
        }


        // --------------------------------------------------
        // 2. Get both wallets and LOCK them
        // --------------------------------------------------

        const walletResult = await client.query(
            `
            SELECT *
            FROM wallets
            WHERE user_id IN ($1, $2)
            ORDER BY id
            FOR UPDATE
            `,
            [fromUserId, toUserId]
        );

        if (walletResult.rows.length !== 2) {

            const error = new Error(
                'Sender or receiver wallet not found'
            );

            error.statusCode = 404;
            error.code = 'WALLET_NOT_FOUND';

            throw error;
        }


        const senderWallet = walletResult.rows.find(
            wallet => wallet.user_id === fromUserId
        );

        const receiverWallet = walletResult.rows.find(
            wallet => wallet.user_id === toUserId
        );


        // --------------------------------------------------
        // 3. Validate wallet states
        // --------------------------------------------------

        if (
            senderWallet.status !== 'ACTIVE' ||
            receiverWallet.status !== 'ACTIVE'
        ) {

            const error = new Error(
                'Both wallets must be active'
            );

            error.statusCode = 409;
            error.code = 'WALLET_NOT_ACTIVE';

            throw error;
        }


        // --------------------------------------------------
        // 4. Validate balance
        // --------------------------------------------------

        if (Number(senderWallet.balance) < Number(amount)) {

            const error = new Error(
                'Insufficient wallet balance'
            );

            error.statusCode = 422;
            error.code = 'INSUFFICIENT_BALANCE';

            throw error;
        }


        // --------------------------------------------------
        // 5. Create transaction
        // --------------------------------------------------

        const transactionId = randomUUID();

        await client.query(
            `
            INSERT INTO transactions (
                id,
                type,
                from_wallet_id,
                to_wallet_id,
                amount,
                currency,
                status,
                idempotency_key
            )
            VALUES (
                $1,
                'TRANSFER',
                $2,
                $3,
                $4,
                'INR',
                'PROCESSING',
                $5
            )
            `,
            [
                transactionId,
                senderWallet.id,
                receiverWallet.id,
                amount,
                idempotencyKey
            ]
        );


        // --------------------------------------------------
        // 6. Debit sender
        // --------------------------------------------------

        await client.query(
            `
            UPDATE wallets
            SET
                balance = balance - $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
                amount,
                senderWallet.id
            ]
        );


        // --------------------------------------------------
        // 7. Credit receiver
        // --------------------------------------------------

        await client.query(
            `
            UPDATE wallets
            SET
                balance = balance + $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
                amount,
                receiverWallet.id
            ]
        );


        // --------------------------------------------------
        // 8. Mark transaction completed
        // --------------------------------------------------

        const result = await client.query(
            `
            UPDATE transactions
            SET
                status = 'COMPLETED',
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [transactionId]
        );


        // --------------------------------------------------
        // 9. Commit EVERYTHING
        // --------------------------------------------------

        await client.query('COMMIT');

        return result.rows[0];

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {

        client.release();
    }
};


exports.getTransfer = async (transactionId) => {

    const result = await pool.query(
        `
        SELECT *
        FROM transactions
        WHERE id = $1
          AND type = 'TRANSFER'
        `,
        [transactionId]
    );

    if (result.rows.length === 0) {

        const error = new Error(
            'Transfer not found'
        );

        error.statusCode = 404;
        error.code = 'TRANSFER_NOT_FOUND';

        throw error;
    }

    return result.rows[0];
};