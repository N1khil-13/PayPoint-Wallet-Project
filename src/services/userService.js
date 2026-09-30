const { randomUUID } = require('crypto');
const pool = require('../db/db');

exports.createUser = async (name, email) => {

    const userId = randomUUID();

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userResult = await client.query(
            `
            INSERT INTO users (
                id,
                name,
                email
            )
            VALUES ($1, $2, $3)
            RETURNING id, name, email, created_at, updated_at
            `,
            [userId, name, email]
        );

        await client.query(
            `
            INSERT INTO wallets (
                id,
                user_id,
                currency,
                balance,
                status
            )
            VALUES ($1, $2, 'INR', 0, 'ACTIVE')
            `,
            [randomUUID(), userId]
        );

        await client.query('COMMIT');

        return userResult.rows[0];

    } catch (error) {

        await client.query('ROLLBACK');

        if (error.code === '23505') {
            const duplicateError = new Error('Email already exists');
            duplicateError.statusCode = 409;
            duplicateError.code = 'EMAIL_ALREADY_EXISTS';
            throw duplicateError;
        }

        throw error;

    } finally {
        client.release();
    }
};

exports.getUser = async (id) => {

    const result = await pool.query(
        `
        SELECT id, name, email, created_at, updated_at
        FROM users
        WHERE id = $1
        `,
        [id]
    );

    if (result.rows.length === 0) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
    }

    return result.rows[0];
};

exports.getWalletByUserId = async (userId) => {

    const result = await pool.query(
        `
        SELECT
            w.id,
            w.user_id,
            w.currency,
            w.balance,
            w.status,
            w.created_at,
            w.updated_at
        FROM wallets w
        WHERE w.user_id = $1
        `,
        [userId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Wallet not found');
        error.statusCode = 404;
        error.code = 'WALLET_NOT_FOUND';
        throw error;
    }

    return result.rows[0];
};