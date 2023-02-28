try {
    const router = require('express').Router();
    const { header, validationResult } = require('express-validator');
    const verifyToken = require("../../middlewares/verify-jwt-token");
    const { getUsers } = require('../../controllers/users-controller')


    router.get("/token", [
        header("token", "Please provide valid token...").isLength({ min: 30 }),
    ], async (req, res) => {
        const errors = validationResult(req)

        if (!errors.isEmpty()) {
            return res.status(411).json({
                id: 2,
                statusCode: 411,
                message: "Token validation failed..."
            });
        } else if (errors.isEmpty()) {
            try {
                const authToken = req.header('token')

                const { id, err } = verifyToken({ authToken })
                if (err) {
                    return res.status(400).json({
                        id: 2,
                        statusCode: 400,
                        message: "Token validation failed..."
                    })
                }

                const { user, error } = await getUsers({ id });
                if (error) {
                    return res.status(400).json({
                        id: 2,
                        statusCode: 400,
                        message: "Token validation failed..."
                    })
                }

                return res.status(200).json({
                    id: 2,
                    statusCode: 200,
                    message: "Token validation successfully...",
                    user
                })
            } catch (error) {
                return res.status(400).json({
                    id: 2,
                    statusCode: 400,
                    message: "Internal server error..."
                })
            }
        }
    })

    module.exports = router
} catch (error) {
    console.log("Some error occured in the auth-users main branch: ", error)
}