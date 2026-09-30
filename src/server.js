require('dotenv').config();

const app = require('./app');
const pool = require('./db/db');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await pool.query('SELECT NOW()');

        console.log('Connected to PostgreSQL');

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

startServer();