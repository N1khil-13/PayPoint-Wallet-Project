CREATE EXTENSION IF NOT EXISTS "pgcrypto";


CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE wallets (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL UNIQUE
        REFERENCES users(id),

    currency VARCHAR(3) NOT NULL DEFAULT 'INR',

    balance BIGINT NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wallet_currency_check
        CHECK (currency = 'INR'),

    CONSTRAINT wallet_balance_check
        CHECK (balance >= 0),

    CONSTRAINT wallet_status_check
        CHECK (status IN ('ACTIVE', 'BLOCKED'))
);


CREATE TABLE transactions (
    id UUID PRIMARY KEY,

    type VARCHAR(20) NOT NULL,

    from_wallet_id UUID
        REFERENCES wallets(id),

    to_wallet_id UUID
        REFERENCES wallets(id),

    amount BIGINT NOT NULL,

    currency VARCHAR(3) NOT NULL DEFAULT 'INR',

    status VARCHAR(20) NOT NULL,

    idempotency_key VARCHAR(255) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transaction_amount_check
        CHECK (amount > 0),

    CONSTRAINT transaction_type_check
        CHECK (type IN ('DEPOSIT', 'TRANSFER')),

    CONSTRAINT transaction_status_check
        CHECK (
            status IN (
                'PROCESSING',
                'COMPLETED',
                'FAILED'
            )
        )
);


CREATE INDEX idx_transactions_from_wallet
ON transactions(from_wallet_id);


CREATE INDEX idx_transactions_to_wallet
ON transactions(to_wallet_id);


CREATE INDEX idx_transactions_created_at
ON transactions(created_at);