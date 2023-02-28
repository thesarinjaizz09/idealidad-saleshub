const jwt = require('jsonwebtoken')
const dotenv = require('dotenv');

dotenv.config();
const jwt__Key = process.env.SALESHUB_JWT_KEY;

const verifyToken = (req, res, next) => {
    const jwtToken = req.header('auth-token');

    if (!jwtToken) {
        res.status(401).json({
            id: 5,
            statusCode: 401,
            message: "Token validation failed...."
        })
    } else {
        try {
            const data = jwt.verify(jwtToken, jwt__Key);
            req.credentials = data.credentials;
            next();
        } catch (error) {
            res.status(401).json({
                id: 5,
                statusCode: 401,
                message: 'Token validation failed....'
            })
        }
    }
}

// Exporting the module to be used by other modules

module.exports = verifyToken; // Exporting the verifytoken function for routing

// CommerceFox verifier codebase finished