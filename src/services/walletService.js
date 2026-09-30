const { randomUUID } = require('crypto');
const pool = require('../db/db');

exports.getWallet = async (walletId) => {

    const result = await pool.query(
        `
        SELECT
            id,
            user_id,
            currency,
            balance,
            status,
            created_at,
            updated_at
        FROM wallets
        WHERE id = $1
        `,
        [walletId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Wallet not found');
        error.statusCode = 404;
        error.code = 'WALLET_NOT_FOUND';
        throw error;
    }

    return result.rows[0];
};


exports.deposit = async (walletId, amount, idempotencyKey) => {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        // Check for an existing idempotent request
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
                transaction.to_wallet_id !== walletId ||
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

        // Lock wallet
        const walletResult = await client.query(
            `
            SELECT *
            FROM wallets
            WHERE id = $1
            FOR UPDATE
            `,
            [walletId]
        );

        if (walletResult.rows.length === 0) {
            const error = new Error('Wallet not found');
            error.statusCode = 404;
            error.code = 'WALLET_NOT_FOUND';
            throw error;
        }

        const wallet = walletResult.rows[0];

        if (wallet.status !== 'ACTIVE') {
            const error = new Error('Wallet is not active');
            error.statusCode = 409;
            error.code = 'WALLET_NOT_ACTIVE';
            throw error;
        }

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
                'DEPOSIT',
                NULL,
                $2,
                $3,
                'INR',
                'PROCESSING',
                $4
            )
            `,
            [
                transactionId,
                walletId,
                amount,
                idempotencyKey
            ]
        );

        await client.query(
            `
            UPDATE wallets
            SET
                balance = balance + $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [amount, walletId]
        );

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

        await client.query('COMMIT');

        return result.rows[0];

    } catch (error) {

        await client.query('ROLLBACK');

        if (error.code === '23505') {
            const existing = await client.query(
                `
                SELECT *
                FROM transactions
                WHERE idempotency_key = $1
                `,
                [idempotencyKey]
            );

            if (existing.rows.length > 0) {
                return existing.rows[0];
            }
        }

        throw error;

    } finally {
        client.release();
    }
};


exports.getTransactions = async (walletId) => {

    const result = await pool.query(
        `
        SELECT *
        FROM transactions
        WHERE from_wallet_id = $1
           OR to_wallet_id = $1
        ORDER BY created_at DESC
        `,
        [walletId]
    );

    return result.rows;
};