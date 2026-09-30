const userService = require('../services/userService');

exports.createUser = async (req, res, next) => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            const error = new Error('Name and email are required');
            error.statusCode = 400;
            error.code = 'INVALID_REQUEST';
            throw error;
        }

        const user = await userService.createUser(name, email);

        res.status(201).json(user);
    } catch (error) {
        next(error);
    }
};

exports.getUser = async (req, res, next) => {
    try {
        const user = await userService.getUser(req.params.id);

        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};

exports.getWallet = async (req, res, next) => {
    try {
        const wallet = await userService.getWalletByUserId(
            req.params.id
        );

        res.json(wallet);

    } catch (error) {
        next(error);
    }
};