try {
    const router = require('express').Router();
    const { header, validationResult } = require('express-validator');
    const verifyUser = require("../middlewares/verify-jwt-token");
    const { getUsers, updateUsers, deleteUsers, addUsers } = require('../../controllers/users-controller')
    const { addTeam, deleteTeam, updateTeam, getTeam, getTeamPassword } = require("../../controllers/teams-controller")
    const { addChat, updateChat, findChat, getChat, createChat } = require('../../controllers/messages-controller')
    const verifyToken = require("../..//middlewares/verify-jwt-token")
    const dotenv = require('dotenv');

    dotenv.config()

    router.get('/details', [
        header("auth-token", "Please provide valid auth token...").isLength({ min: 3 }),
        header("chatNumber", "Please provide chat name...").isLength({ min: 3 }),
        header("password", "Please provide password...").isLength({ min: 3 }),
    ], async (req, res) => {
        const password = req.header('password')
        if (password === process.env.SERVER_SOCKET_PASSWORD) {
            const errors = validationResult(req)

            if (!errors.isEmpty()) {
                return res.status(411).json({
                    id: 2,
                    statusCode: 411,
                    message: "Please provide valid credentials...",
                    errors: errors.array(),
                });
            } else if (errors.isEmpty()) {
                const chatNumber = req.header('chatNumber')
                const authToken = req.header('auth-token')
                console.log({ chatNumber })
                console.log({ authToken })

                const { id, err } = verifyToken({ authToken })
                if (err) return res.send(404).json({
                    message: err
                })
                console.log({ id })

                const { user, error } = await getUsers({ id });
                if (error) return res.send(404).json({
                    message: error
                })
                console.log({ user })
                if (user._teamRole === "neutral" && user._teamId === "") {
                    const checkChat = (chat) => {
                        return chat.chatNumber === chatNumber;
                    }
                    console.log(user._ownChats.find(checkChat))
                    if (!user._ownChats.find(checkChat)) {
                        res.sendStatus(404).json({
                            message: 'Chat not found...'
                        })
                    }

                    const getChatDetails = (chat) => {
                        if (chat.chatNumber === chatNumber) {
                            return chat
                        }
                    }
                    const foundChat = user._ownChats.find(getChatDetails);

                    const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                    if (chatGettingErr) return res.send(404).json({
                        message: chatGettingErr
                    })

                    return res.status(200).json({
                        message: 'Chat found...',
                        chat: existingChat
                    })
                } else if (user._teamRole !== 'neutral' && user._teamId !== "") {
                    var { team, errr } = await getTeam({ teamId: user._teamId });
                    if (errr) return res.send(404).json({
                        message: errr
                    });

                    const checkChat = (chat) => {
                        return chat.chatNumber === chatNumber;
                    }
                    if (!team._teamChats.find(checkChat)) return res.send(404).json({
                        message: 'Chat not found...'
                    })

                    const getChatDetails = (chat) => {
                        if (chat.chatNumber === chatNumber) {
                            return chat
                        }
                    }
                    const foundChat = team._teamChats.find(getChatDetails);

                    const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                    if (chatGettingErr) return res.send(404).json({
                        message: chatGettingErr
                    })

                    return res.status.json({
                        message: 'Chat found...',
                        chat: existingChat
                    })
                }
            }
        } else {
            return res.send(404).json({
                message: 'Access denied...'
            })
        }
    })

    module.exports = router;
} catch (err) {
    console.log(err)
}