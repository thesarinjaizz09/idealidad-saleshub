const jwt = require('jsonwebtoken')
const dotenv = require('dotenv');

dotenv.config();
const jwt__Key = process.env.SALESHUB_JWT_KEY;

const verifyToken = ({ authToken }) => {
    if (!authToken) {
        return {
            err: 'Token validation failed...'
        }
    } else {
        try {
            const data = jwt.verify(authToken, jwt__Key);
            const id = data.credentials.id

            return {
                id
            }
        } catch (error) {
            return {
                err: 'Token validation failed...'
            }
        }
    }
}

module.exports = verifyToken