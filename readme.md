# P2P Wallet API

A simple REST API for managing users, wallets, deposits, and peer-to-peer transfers.

The project is built with Node.js, Express, and PostgreSQL. The main focus was making sure that money movement is safe when requests are retried or multiple transfers happen at the same time.

## Tech Stack

* Node.js
* Express.js
* PostgreSQL
* `pg` for PostgreSQL connection
* Jest / Supertest for testing
* Postman for API testing

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd PayPoint
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=wallet_db
DB_USER=postgres
DB_PASSWORD=your_password
```

I have intentionally kept the actual database password out of the repository.

### 4. Create the database

Create a PostgreSQL database called:

```text
wallet_db
```

Then run the SQL file located at:

```text
src/db/schema.sql
```

This creates the users, wallets, and transactions tables along with the required constraints and indexes.

### 5. Start the server

```bash
npm start
```

The API will be available at:

```text
http://localhost:3000
```

You can also check whether the server is running:

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

# API Endpoints

## Users

### Create a user

```http
POST /users
```

Request:

```json
{
  "name": "Alice",
  "email": "alice@example.com"
}
```

Creating a user also creates their wallet automatically.

### Get a user

```http
GET /users/:id
```

### Get user's wallet

```http
GET /users/:id/wallet
```

---

## Wallets

### Get wallet

```http
GET /wallets/:walletId
```

### Deposit money

```http
POST /wallets/:walletId/deposit
```

Request:

```json
{
  "amount": 100000,
  "idempotency_key": "deposit-alice-001"
}
```

Amounts are stored in **paise**, so:

```text
100000 = ₹1,000
50000  = ₹500
```

The deposit creates a transaction and updates the wallet balance as part of the same database transaction.

### Get wallet transactions

```http
GET /wallets/:walletId/transactions
```

---

# P2P Transfers

### Create a transfer

```http
POST /transfers
```

Request:

```json
{
  "from_user_id": "sender-user-id",
  "to_user_id": "receiver-user-id",
  "amount": 30000,
  "idempotency_key": "transfer-001"
}
```

For example, `30000` represents ₹300.

The transfer performs the following operations inside one PostgreSQL transaction:

1. Find the sender and receiver wallets.
2. Lock both wallet rows.
3. Check that both wallets are active.
4. Check the sender has enough balance.
5. Create the transaction as `PROCESSING`.
6. Debit the sender.
7. Credit the receiver.
8. Mark the transaction as `COMPLETED`.
9. Commit the transaction.

If anything fails, the entire transaction is rolled back.

### Get a transfer

```http
GET /transfers/:transactionId
```

---

# Idempotency

Both deposits and transfers require an `idempotency_key`.

The idea is that if a client sends the same request twice, it should not move the money twice.

For example:

```json
{
  "from_user_id": "user-a",
  "to_user_id": "user-b",
  "amount": 50000,
  "idempotency_key": "transfer-123"
}
```

If the exact same request is sent again with `transfer-123`, the existing transaction is returned instead of creating another transfer.

The database also has a unique constraint on `idempotency_key`, so concurrent duplicate requests cannot create multiple transactions.

If the same key is reused for a different request, the API returns a conflict instead of silently processing it.

---

# Concurrency

Concurrency was one of the main considerations in the implementation.

For transfers, the sender and receiver wallet rows are locked using PostgreSQL's:

```sql
SELECT ... FOR UPDATE
```

This means two transfers trying to modify the same wallet at the same time cannot both read the same old balance and spend it.

For example, if Alice has ₹500 and two requests simultaneously try to transfer ₹400:

* The first transaction gets the wallet lock.
* It transfers ₹400.
* The second transaction waits for the lock.
* After the first transaction commits, the second transaction reads the updated balance.
* It then fails because only ₹100 remains.

The wallet balance also has a database-level constraint preventing it from becoming negative.

When locking multiple wallets, they are selected in a consistent order to reduce the possibility of deadlocks.

---

# Money Handling

I didn't use JavaScript floating-point numbers for storing money.

Amounts are represented as integer **paise**.

For example:

```text
₹1      = 100 paise
₹10     = 1000 paise
₹100.50 = 10050 paise
```

The PostgreSQL balance and transaction amount use `BIGINT`.

This avoids problems that can occur when using floating-point arithmetic for financial values.

---

# Transaction States

Transactions have three possible states:

```text
PROCESSING
COMPLETED
FAILED
```

The intended state flow is:

```text
PROCESSING → COMPLETED
PROCESSING → FAILED
```

A completed or failed transaction should not be moved back into another state.

The current implementation performs the wallet movement synchronously, so most failures cause the PostgreSQL transaction to roll back completely. The `FAILED` state is still part of the model for cases where transaction processing is expanded later.

---

# Database Design

There are three main tables.

### users

Stores basic user information.

Important constraint:

```text
email UNIQUE
```

### wallets

Each user has one wallet.

Important constraint:

```text
user_id UNIQUE
```

This guarantees that a user cannot accidentally have multiple wallets.

The wallet also has:

```text
currency = INR
balance >= 0
```

### transactions

Stores deposits and transfers.

A transaction records:

* Transaction ID
* Transaction type
* Source wallet
* Destination wallet
* Amount
* Currency
* Status
* Idempotency key
* Created/updated timestamps

Indexes are added to the wallet IDs and transaction creation time because transaction history will commonly be queried by wallet.

---

# Atomicity

Money movement and transaction records are handled together.

For example, during a transfer, these operations happen inside the same PostgreSQL transaction:

```text
Create transaction
       ↓
Debit sender
       ↓
Credit receiver
       ↓
Mark transaction completed
       ↓
COMMIT
```

If the debit succeeds but something fails before the credit, PostgreSQL rolls everything back.

This prevents situations where money disappears from one wallet without appearing in the other.

---

# Error Handling

The API returns structured errors with appropriate HTTP status codes.

Example:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance"
  }
}
```

Some of the handled cases include:

* Invalid request
* Invalid amount
* User not found
* Wallet not found
* Wallet not active
* Duplicate email
* Insufficient balance
* Same sender and receiver
* Idempotency key reuse
* Transfer not found

---

# Testing

The main scenarios I tested include:

* Creating users
* Automatically creating wallets
* Depositing money
* Successful transfers
* Insufficient balance
* Duplicate requests using the same idempotency key
* Reusing an idempotency key with different data
* Preventing transfers to the same user
* Transaction history
* Concurrent transfers
* Rollback/atomicity scenarios

Postman can be used to manually test all of the API endpoints.

---

# Assumptions

A few assumptions were made while implementing the assignment:

* The wallet currency is INR only.
* Every user gets exactly one wallet.
* Authentication was kept outside the scope of the core wallet implementation.
* Amounts sent to the API are represented in paise.
* Transfers are synchronous.
* A transfer between the same sender and receiver is rejected.
* Idempotency keys are globally unique in the transactions table.

The assignment mentions authentication using a mobile number and PIN, but the initial user requirements only specify `name` and `email`. I therefore kept authentication outside the core implementation rather than introducing an additional authentication system that wasn't otherwise specified.

If authentication were added, the PIN would be stored as a secure hash and never as plain text.

---

# Production Considerations

For a larger production system, I would additionally consider:

* Authentication and authorization
* Rate limiting
* Better request validation
* Audit logging
* Monitoring and alerting
* Database connection pool tuning
* Transaction reconciliation
* An outbox/event system for reliable downstream events
* Pagination for transaction history
* Partitioning transaction history at larger volumes
* Better handling for long-running/asynchronous transactions
* Fraud and transfer limits
* API request tracing

The current implementation intentionally keeps the scope focused on the wallet and money-transfer requirements of the assignment.

---

# Project Structure

```text
PayPoint/
│
├── src/
│   ├── controllers/
│   │   ├── userController.js
│   │   ├── walletController.js
│   │   └── transferController.js
│   │
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── walletRoutes.js
│   │   └── transferRoutes.js
│   │
│   ├── services/
│   │   ├── userService.js
│   │   ├── walletService.js
│   │   └── transferService.js
│   │
│   ├── middleware/
│   │   └── errorHandler.js
│   │
│   ├── db/
│   │   ├── db.js
│   │   └── schema.sql
│   │
│   ├── app.js
│   └── server.js
│
├── tests/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Notes

The main goal of the implementation was not just to make the endpoints work, but to make the actual money movement safe.

In particular, idempotency, database transactions, row locking, and database constraints were treated as part of the core design rather than as additional features.
