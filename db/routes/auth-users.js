try {
    const router = require('express').Router();
    const users = require('../models/user-model');
    const { header, validationResult } = require('express-validator');
    const jwt = require('jsonwebtoken');
    const verifyUser = require("../middlewares/verify-jwt-token");
    const encrypter = require("../../lib/encryption/encrypter")
    const decrypter = require("../../lib/decryption/decrypter")
    const dotenv = require('dotenv');
    const nodemailer = require('nodemailer')
    const puppeteer = require('puppeteer');

    dotenv.config()
    const jwt__Key = process.env.SALESHUB_JWT_KEY;

    router.post("/register", [
        header("name", "Please provide valid name...").isLength({ min: 3 }),
        header("email", "Please provide valid email...").isEmail(),
        header("password", "Please provide valid password...").isLength({ min: 8 })
    ], async (req, res) => {
        const errors = validationResult(req)

        if (!errors.isEmpty()) {
            return res.status(411).json({
                id: 2,
                statusCode: 411,
                message: "Please provide valid credentials...",
                errors: errors.array(),
            });
        } else if (errors.isEmpty()) {
            try {
                if (req.header('serverPass') === process.env.SERVER_PASSWORD) {
                    let registeredUserEmail = await users.findOne({
                        _email: req.header('email')
                    })

                    if (registeredUserEmail) {
                        return res.status(409).json({
                            id: 16,
                            statusCode: 409,
                            message: "Email already registered...",
                        });
                    } else {
                        let newUser = await users.create({
                            _name: `${req.header('name').trim()} `,
                            _email: req.header('email').trim(),
                            _password: await encrypter(req.header('password').trim())
                        })

                        const payload = {
                            credentials: {
                                id: newUser._id
                            }
                        }

                        var token = jwt.sign(payload, jwt__Key);

                        // const browser = await puppeteer.launch({
                        //     headless: false
                        // });
                        // const page = await browser.newPage();
                        // await page.goto('https://localhost:3000');

                        return res.status(201).json({
                            id: 13,
                            statusCode: 201,
                            message: "User registered succesfully...",
                            password: process.env.CLIENT_PASSWORD,
                            credentials: {
                                authToken: token,
                            },
                        });
                    }
                } else {
                    return res.status(400).json({
                        id: 20,
                        statusCode: 400,
                        message: "Access denied...",
                    });
                }
            } catch (error) {
                console.log("Some error occured in the auth-users register route: ", error)
                return res.status(500).json({
                    id: 20,
                    statusCode: 500,
                    message: "Internal server error...",
                });
            }
        }
    })

    router.get("/login", [
        header("email", "Please provide valid email...").isEmail(),
        header("password", "Please provide valid password...").isLength({ min: 8 })
    ], async (req, res) => {
        const errors = validationResult(req)

        if (!errors.isEmpty()) {
            return res.status(411).json({
                id: 2,
                statusCode: 411,
                message: "Please provide valid credentials...",
                errors: errors.array(),
            });
        } else if (errors.isEmpty()) {
            try {
                if (req.header('serverPass') === process.env.SERVER_PASSWORD) {
                    let user = await users.findOne({
                        _email: req.header("email")
                    })

                    if (user) {
                        let password = decrypter(user._password);
                        console.log(password)
                        if (req.header('password') === password) {

                            const payload = {
                                credentials: {
                                    id: user._id,
                                },
                            };

                            var token = jwt.sign(payload, jwt__Key);

                            // const browser = await puppeteer.launch({
                            //     headless: false
                            // });
                            // const page = await browser.newPage();
                            // await page.goto('http://localhost:3000/');

                            return res.status(201).json({
                                id: 13,
                                statusCode: 201,
                                message: "User authenticated succesfully...",
                                password: process.env.CLIENT_PASSWORD,
                                credentials: {
                                    authToken: token,
                                },
                            });
                        } else {
                            return res.status(400).json({
                                id: 14,
                                statusCode: 400,
                                message: "Wrong credentials entered...",
                            });
                        }
                    } else {
                        return res.status(400).json({
                            id: 14,
                            statusCode: 400,
                            message: "Wrong credentials entered...",
                        });
                    }
                } else {
                    return res.status(400).json({
                        id: 20,
                        statusCode: 400,
                        message: "Access denied...",
                    });
                }
            } catch (error) {
                console.log("Some error occured in the auth-users login route: ", error)
                return res.status(500).json({
                    id: 20,
                    statusCode: 500,
                    message: "Internal server error...",
                });
            }
        }
    })

    router.get("/user", verifyUser, async (req, res) => {
        try {
            if (req.header('serverPass') === process.env.SERVER_PASSWORD) {
                const userData = await users.findById(req.credentials.id).select("-_password"); // Selecting all the fields except the password one from the user document
                if (!userData) {
                    return res.status(400).json({
                        id: 18,
                        statusCode: 400,
                        message: 'No such user data...'
                    })
                } else {
                    return res.status(200).json({
                        id: 12,
                        statusCode: 200,
                        message: "User data fetched successfully...",
                        password: process.env.CLIENT_PASSWORD,
                        data: userData
                    })
                }
            } else {
                return res.status(400).json({
                    id: 20,
                    statusCode: 400,
                    message: "Access denied...",
                });
            }
        } catch (error) {
            console.log("Some error occured in the auth-users user route: ", error)
            return res.status(500).json({
                id: 20,
                statusCode: 500,
                message: "Internal server error...",
            });
        }
    })

    const sendEmailVerificationEmail = async (recieptentEmail) => {
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'user.verify.idealidad@gmail.com',
                pass: 'Sarinjazz@'
            }
        })

        var mailOptions = {
            from: 'user.verify.idealidad@gmail.com',
            to: 'jazzsarin28@gmail.com',
            subject: 'Verify Email',
            text: 'Here is your verify link'
        }

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error)
            } else {
                console.log('Email Sent' + info.response)
            }
        })
    }

    module.exports = router;
} catch (error) {
    console.log("Some error occured in the auth-users main branch: ", error)
}