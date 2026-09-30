const express = require('express');

const userRoutes = require('./routes/userRoutes');
const walletRoutes = require('./routes/walletRoutes');
const transferRoutes = require('./routes/transferRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'ok'
    });
});

app.use('/users', userRoutes);
app.use('/wallets', walletRoutes);
app.use('/transfers', transferRoutes);

app.use(errorHandler);

module.exports = app;