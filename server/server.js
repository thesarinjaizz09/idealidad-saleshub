try {
    const express = require('express');
    const cors = require('cors');
    const dotenv = require('dotenv');
    const helmet = require('helmet');
    const morgan = require('morgan');
    const puppeteer = require('puppeteer');
    const http = require("http");
    const path = require('path')
    const { Server } = require("socket.io")
    const authUsers = require('./db/routes/auth-users')
    const authChats = require('./db/routes/auth-chats')
    const authTokens = require('./db/routes/auth-tokens')
    const connectToDatabase = require('./db/connect-to-database')
    const generateConnectionUrl = require("./src/connection-url-generator")
    const decrypter = require("./lib/decryption/decrypter")
    const verifyToken = require("./middlewares/verify-jwt-token")
    const { getUsers, updateUsers, addUsers } = require('./controllers/users-controller')
    const { addTeam, deleteTeam, updateTeam, getTeam, getTeamPassword } = require("./controllers/teams-controller")
    const { updateChat, getChat, createChat, deleteChat, addChat } = require('./controllers/messages-controller')
    const { addFunnels, getFunnels, updateFunnels, deleteFunnels } = require('./controllers/funnels-controller')
    const { addDirectory, getDirectory, updateDirectory, deleteDirectory } = require('./controllers/directory-controller')
    const { google } = require("googleapis");
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const { MessageMedia } = require('whatsapp-web.js');
    var client_wp_sessions = []
    var browser_wp_sessions = []
    var browser;

    // Server configuration

    dotenv.config()
    connectToDatabase();
    const app = express();
    const port = process.env.PORT || 1337;
    const connection_string = generateConnectionUrl(60)

    // Adding the middlewares

    app.use(express.json()); // Specifying the server to use the json function of the EXPRESS framework
    app.use(cors())  // Specifying the server to use the cors module
    app.use(helmet()); // Specifying the server to use the helmet module
    app.use(morgan("common")); // Specifying the server to use the morgan module
    app.use("/api/auth", authUsers)
    app.use("/api/chat", authChats)
    app.use("/api/verify", authTokens)
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('/home', function (req, res) {
        res.sendFile(path.join(__dirname + '/public/client.html'));
    });
    const server = http.createServer(app);

    const io = new Server(server, {
        cors: {
            origin: ["http://localhost:3000", "http://localhost:1338"],
            methods: ["GET", "POST", "PUT", "DELETE"],
        },
    });

    io.on("connection", async (socket) => {
        console.log("User connected:", socket.id)
        var clientCopy;
        var userAuthToken = "";
        var globalFromInstance = false;
        var registerCount = 0;

        socket.on("get_user", async ({ authToken, fromInstance, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    globalFromInstance = fromInstance

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (user._teamId !== "" && user._teamRole !== 'neutral') {
                        var { team, errr } = await getTeam({ teamId: user._teamId });
                        if (errr) return callback(errr);

                        socket.leave(user._teamId)
                        socket.join(user._teamId)
                        // const room_size = io.sockets.adapter.rooms.get(user._teamId).size

                        // other actions...
                        // await browser.close();
                        // if (id === team._teamAdmin) {
                        //     const checkUser = (member) => {
                        //         return member.id === id
                        //     }

                        //     if (team._teamMembers.find(checkUser)) {
                        //         if (team._teamActiveMembers.find(checkUser)) {
                        //             if (team._teamAdmin === id) {
                        //                 const teamUpdates = {
                        //                     _teamWpLeader: id,
                        //                 }

                        //                 const { updatedTeam, errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })
                        //                 if (errrr) return callback(errrr)
                        //             } else if (team._teamAdmin !== id) {
                        //                 const teamSize = team._teamActiveMembers;
                        //                 if (teamSize === 1) {
                        //                     const teamUpdates = {
                        //                         _teamWpLeader: id,
                        //                     }

                        //                     const { updatedTeam, errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })
                        //                     if (errrr) return callback(errrr)
                        //                 }
                        //             }
                        //         } else {
                        //             if (team._teamAdmin === id) {
                        //                 const teamUpdates = {
                        //                     _teamWpLeader: id,
                        //                     _teamActiveMembers: [{
                        //                         name: user._name,
                        //                         id: id,
                        //                         role: 'admin'
                        //                     }, ...team._teamActiveMembers]
                        //                 }
                        //                 const { updatedTeam, errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })
                        //                 if (errrr) return callback(errrr)
                        //             }
                        //         }


                        //     }
                        // }
                        // if (room_size > 1) {

                        // } else if (room_size === 1) {
                        //     const teamUpdates = {

                        //     }
                        // }
                    }

                    socket.emit("got_user", { password: process.env.CLIENT_SOCKET_PASSWORD, user })

                    if (!fromInstance) {
                        const checkActiveSession = (browser) => {
                            return browser.sessionId === user._wpSessionData
                        }

                        const getActiveSession = (browser) => {
                            if (browser.sessionId === user._wpSessionData) {
                                return browser
                            }
                        }
                        if (user._teamRole !== 'seller' && registerCount === 0) {
                            if (user._wpIntegration && user._wpSessionData !== "" && user._wpInstanceActive) {
                                if (browser_wp_sessions.find(checkActiveSession)) {
                                    const page = browser_wp_sessions.find(getActiveSession)
                                    await page.page.close()

                                    for (let index = 0; index < browser_wp_sessions.length; index++) {
                                        const element = browser_wp_sessions[index];
                                        if (element.sessionId === user._wpSessionData) {
                                            browser_wp_sessions.splice(index, 1)
                                            break;
                                        }
                                    }

                                    const userUpdates = {
                                        _wpInstanceActive: false
                                    }
                                    const { errrrr } = await updateUsers({ id, userUpdates })
                                    registerCount++;
                                }
                            }
                        }
                    }
                    userAuthToken = authToken
                    return callback()
                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log('Error in get_user handler:', err)
                // return callback('Internal server error...')
            }
        })

        socket.on("get_user_team", async ({ authToken, password, teamId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback('User authentication failed...')
                    if (user._teamRole === 'neutral' && user._teamId === "") return callback("You need to join a team first...")
                    if (user._teamId !== teamId) return callback("Team authentication failed...")

                    var { team, errr } = await getTeam({ teamId });
                    if (errr) return callback(errr);

                    const checkUser = (user) => {
                        return user.id === id;
                    }

                    var teamData;
                    if (team._teamPendingMembers.find(checkUser)) {
                        var teamMembers = team._teamPendingMembers;
                        for (let index = 0; index < teamMembers.length; index++) {
                            const element = teamMembers[index];
                            if (`"${element.id}"` === JSON.stringify(user._id)) {
                                teamMembers.splice(index, 1)
                                break;
                            }
                        }
                        const teamUpdates = {
                            _teamMembers: [...team._teamMembers, {
                                name: user._name,
                                role: user._teamRole,
                                id: user._id
                            }],
                            _teamPendingMembers: teamMembers
                        }

                        const { updatedTeam, errrr } = await updateTeam({ teamId, teamUpdates })
                        if (errrr) return callback(errrr)

                        teamData = updatedTeam
                        socket.leave(user._teamId)
                        socket.join(team._id)

                        io.to(user._teamId).emit("team_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedTeam })
                    }

                    team = teamData ? teamData : team

                    socket.emit("got_user_team", { password: process.env.CLIENT_SOCKET_PASSWORD, team })
                    return callback()
                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log("Some error occurred in get_user_team handler:", err)
                return callback('Internal server error...')
            }
        })

        socket.on("register_user_team", async ({ authToken, teamName, teamPassword, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    var globalTeam
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback('User authentication failed...')
                    if (user._teamRole === "admin" || user._teamId !== "") return callback('You cannot create multiple teams..')
                    if (user._teamRole === "seller" || user._teamId !== "") return callback('You cannot create teams..')
                    if (user._teamRole === "neutral" && user._teamId === "") {
                        const teamMembers = [
                            {
                                name: user._name,
                                id: user._id,
                                role: 'admin'
                            }
                        ]
                        const { newTeam, errr } = await addTeam({ teamName, teamPassword, id, teamMembers });
                        if (errr) return callback(errr);
                        globalTeam = newTeam

                        if (newTeam._teamAdmin !== id && `"${newTeam._teamAdmin}"` !== JSON.stringify(user._id)) return callback('Registration thread denied...')

                        const userUpdates = {
                            _teamId: newTeam._id,
                            _teamRole: 'admin',
                            _wpChats: []
                        }
                        const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                        if (errrrr) return callback(errrrr);

                        const teamUpdates = {
                            _teamAdminAuthToken: authToken
                        }
                        const { updatedTeam, errrr } = await updateTeam({ teamId: newTeam._id, teamUpdates })
                        if (errrr) return callback(errrr)

                        if (updatedUser._wpIntegration && updatedUser._wpSessionData !== "") {
                            const teamUpdates = {
                                _teamWpIntegration: true,
                                _teamWpSessionData: updatedUser._wpSessionData
                            }
                            const { updatedTeam, errrr } = await updateTeam({ teamId: newTeam._id, teamUpdates })
                            if (errrr) return callback(errrr)

                            globalTeam = updatedTeam
                        }

                        socket.leave(user._teamId)
                        socket.join(updatedUser._teamId)

                        socket.emit("registered_user_team", { password: process.env.CLIENT_SOCKET_PASSWORD, newTeam: globalTeam })
                        socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                        return callback()
                    }
                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log('Some error occurred in the register_user_team handler:', err)
                return callback('Internal server error...')
            }
        })

        socket.on("add_member", async ({ authToken, teamId, memberName, memberEmail, memberPassword, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback('User authentication failed...')
                    if (user._teamRole !== "admin" || user._teamId === "" || user._teamId !== teamId) return callback('Only admins can add members to team..')

                    const { team, errr } = await getTeam({ teamId });
                    if (errr) return callback(errr);

                    const checkUser = (user) => {
                        return user.name === memberName;
                    }
                    if (team._teamMembers.find(checkUser)) return callback("Member already exists...")
                    if (team._teamAdmin !== id) return callback("Only admins can add memebers to team...")

                    const { newUser, errrror } = await addUsers({ memberName, memberEmail, memberPassword, teamId })
                    if (errrror) return callback(errrror)

                    const teamUpdates = {
                        _teamPendingMembers: [...team._teamPendingMembers, {
                            name: newUser._name,
                            id: newUser._id,
                            role: 'seller'
                        }]
                    }
                    const { updatedTeam, errrr } = await updateTeam({ teamId, teamUpdates })
                    if (errrr) return callback(errrr)

                    socket.emit("team_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedTeam })
                    socket.emit("member_added", { password: process.env.CLIENT_SOCKET_PASSWORD })
                    return callback()
                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log('Some error occurred in the add_member handler', err)
                return callback('Internal server error...')
            }
        })

        socket.on("join_team", async ({ authToken, teamId, teamPassword, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback('User authentication failed...')
                    if (user._teamRole !== "neutral" || user._teamId !== "") return callback('You can only join one team at a time..')

                    const { team, errr } = await getTeamPassword({ teamId });
                    if (errr) return callback(errr);

                    const checkUser = (user) => {
                        return user.id === id;
                    }
                    if (team._teamAdmin === id) return callback('Admins cannot join another team...')
                    if (decrypter(team._teamPassword) !== teamPassword) return callback("Password validation failed...")
                    if (team._teamMembers.find(checkUser)) return callback('Already in team...')

                    const teamUpdates = {
                        _teamMembers: [...team._teamMembers, {
                            name: user._name,
                            id: user._id,
                            role: 'seller'
                        }]
                    }
                    const { updatedTeam, errrr } = await updateTeam({ teamId, teamUpdates })
                    if (errrr) return callback(errrr)

                    const userUpdates = {
                        _teamId: updatedTeam._id,
                        _teamRole: 'seller',
                        _wpIntegration: false,
                        _wpSessionData: "",
                        _wpInstanceActive: false,
                        _wpChats: [],
                        _wpChats: [],
                        _wpBackupIntegration: user._wpIntegration,
                        _wpBackupSessionData: user._wpSessionData
                    }
                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                    if (errrrr) return callback(errrrr);

                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                    socket.emit("joined_team", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedTeam })
                    io.to(updatedUser._teamId).emit("team_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedTeam })
                    socket.leave(user._teamId)
                    socket.join(updatedUser._teamId)
                    return callback()
                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log("Some error occurred in the join_team handler:", err)
                return callback('Internal server error...')
            }
        })

        socket.on("leave_team", async ({ authToken, teamId, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback('Leaving thread denied...')
                    if (user._teamRole === "neutral" || user._teamId === "") return callback('Leaving thread denied..')

                    const { team, errr } = await getTeamPassword({ teamId });
                    if (errr) return callback(errr);

                    const checkUser = (user) => {
                        return user.id === id;
                    }

                    if (!team._teamMembers.find(checkUser)) return callback('Leaving thread failed...')

                    var teamMembers = team._teamMembers;
                    var userIndex = 0;
                    for (let index = 0; index < teamMembers.length; index++) {
                        const element = teamMembers[index];
                        if (`"${element.id}"` === JSON.stringify(user._id)) {
                            userIndex = index;
                            teamMembers.splice(userIndex, 1)
                            break;
                        }
                    }

                    const teamUpdates = {
                        _teamMembers: teamMembers
                    }
                    const { updatedTeam, errrr } = await updateTeam({ teamId, teamUpdates })
                    if (errrr) return callback(errrr)

                    socket.leave(user._teamId)

                    for (let index = 0; index < user._wpChats.length; index++) {
                        const chat = user._wpChats[index];

                        const chatUpdates = {
                            _chatHandlerName: "You",
                            _chatHandlerId: "",
                        }
                        const { updatedChat } = await updateChat({ chatId: chat.chatId, chatUpdates })
                        io.to(user._teamId).emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedChat._chatParent })
                    }

                    const userUpdates = {
                        _teamId: "",
                        _teamRole: 'neutral',
                        _wpChats: [],
                        _wpChats: [],
                        _wpIntegration: user._wpBackupIntegration,
                        _wpSessionData: user._wpBackupSessionData
                    }
                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                    if (errrrr) return callback(errrrr);

                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                    io.to(user._teamId).emit("team_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedTeam })
                    socket.emit("left_team", { password: process.env.CLIENT_SOCKET_PASSWORD })
                    socket.leave(user._teamId)
                    return callback()
                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log('Some error occurred in the leave_team handler:', err)
                return callback('Internal server error...')
            }
        })

        socket.on("integrate_googlesheets", async ({ authToken, password, spreadsheetId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);
                    if (spreadsheetId === "") return callback('Please specify the spreadsheetId...')

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (user._gsIntegration && user._gsSessionData !== "") return callback("Google sheets already integrated...")

                    if (!user._gsIntegration && user._gsSessionData === "") {
                        const auth = new google.auth.GoogleAuth({
                            keyFile: "credentials.json",
                            scopes: "https://www.googleapis.com/auth/spreadsheets",
                        });

                        const client = await auth.getClient();
                        const googleSheets = google.sheets({ version: "v4", auth: client });
                        const metaData = await googleSheets.spreadsheets.get({
                            auth,
                            spreadsheetId,
                        });

                        let sheets = [];
                        let index = 0;

                        metaData.data.sheets.forEach((element) => {
                            sheets[index] = element.properties.title;
                            index++;
                        });

                        const userUpdates = {
                            _gsIntegration: true,
                            _gsSessionData: spreadsheetId
                        }
                        const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                        if (errrrr) return callback(errrrr);

                        socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                        socket.emit("sheets_integrated", { password: process.env.CLIENT_SOCKET_PASSWORD, sheets })
                        return callback()
                    }

                } else {
                    return callback("Access denied...")
                }
            } catch (err) {
                console.log(err)
            }
        })

        socket.on("authenticate_googlesheets", async ({ authToken, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (!user._gsIntegration || user._gsSessionData === "") return callback('Google sheets not integrated...')
                    if (user._gsIntegration && user._gsSessionData !== "") {
                        const auth = new google.auth.GoogleAuth({
                            keyFile: "credentials.json",
                            scopes: "https://www.googleapis.com/auth/spreadsheets",
                        });

                        const client = await auth.getClient();
                        const googleSheets = await google.sheets({ version: "v4", auth: client });
                        const metaData = await googleSheets.spreadsheets.get({
                            auth,
                            spreadsheetId: user._gsSessionData,
                        });

                        let sheets = [];
                        let index = 0;

                        await metaData.data.sheets.forEach((element) => {
                            sheets[index] = element.properties.title;
                            index++;
                        });

                        socket.emit("sheets_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD, sheets })

                        if (user._fbIntegration) {
                            setInterval(() => {
                                let index = 0;
                                let sheets2 = [];

                                metaData.data.sheets.forEach((element) => {
                                    sheets2[index] = element.properties.title;
                                    index++;
                                });

                                if (sheets.length !== sheets2.length) {
                                    socket.emit("sheets_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD, sheets })
                                } else {
                                    for (let index = 0; index < sheets.length; index++) {
                                        const element = sheets[index];

                                        if (sheets2[index] !== element) {
                                            socket.emit("sheets_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD, sheets })
                                            break;
                                        }
                                    }
                                }
                            }, 10000)
                        } else {
                            return callback()
                        }
                    }

                } else {
                    return callback('Access denied')
                }
            } catch (err) {
                console.log(err)
            }
        })

        socket.on("get_googlesheets", async ({ authToken, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (!user._gsIntegration || user._gsSessionData === "") return callback('Google sheets not integrated...')
                    if (user._gsIntegration && user._gsSessionData !== "") {
                        const auth = new google.auth.GoogleAuth({
                            keyFile: "credentials.json",
                            scopes: "https://www.googleapis.com/auth/spreadsheets",
                        });

                        const client = await auth.getClient();
                        const googleSheets = await google.sheets({ version: "v4", auth: client });
                        const metaData = await googleSheets.spreadsheets.get({
                            auth,
                            spreadsheetId: user._gsSessionData,
                        });

                        let sheets = [];
                        let index = 0;

                        await metaData.data.sheets.forEach((element) => {
                            sheets[index] = element.properties.title;
                            index++;
                        });

                        socket.emit("got_sheets", { password: process.env.CLIENT_SOCKET_PASSWORD, sheets })
                        if (user._fbIntegration) {
                            setInterval(() => {
                                let index = 0;
                                let sheets2 = [];

                                metaData.data.sheets.forEach((element) => {
                                    sheets2[index] = element.properties.title;
                                    index++;
                                });

                                if (sheets.length !== sheets2.length) {
                                    socket.emit("got_sheets", { password: process.env.CLIENT_SOCKET_PASSWORD, sheets })
                                } else {
                                    for (let index = 0; index < sheets.length; index++) {
                                        const element = sheets[index];

                                        if (sheets2[index] !== element) {
                                            socket.emit("got_sheets", { password: process.env.CLIENT_SOCKET_PASSWORD, sheets })
                                            break;
                                        }
                                    }
                                }
                            }, 10000)
                        } else {
                            return callback()
                        }
                    }

                } else {
                    return callback('Access denied')
                }
            } catch (err) {
                console.log(err)
            }
        })

        socket.on("get_sheets_data", async ({ authToken, password, sheetName }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (!user._gsIntegration && user._gsSessionData === "") return callback('Google sheets not integrated...')

                    if (user._gsIntegration && user._gsSessionData !== "") {
                        const auth = new google.auth.GoogleAuth({
                            keyFile: "credentials.json",
                            scopes: "https://www.googleapis.com/auth/spreadsheets",
                        });

                        const client = await auth.getClient();
                        const googleSheets = google.sheets({ version: "v4", auth: client });

                        const metaData = await googleSheets.spreadsheets.get({
                            auth,
                            spreadsheetId: user._gsSessionData,
                        });
                        let sheets = [];
                        let index = 0;
                        await metaData.data.sheets.forEach((element) => {
                            sheets[index] = element.properties.title;
                            index++;
                        });

                        var flag = false;
                        for (let i = 0; i < sheets.length; i++) {
                            const element = sheets[i];

                            if (element === sheetName) {
                                flag = true;
                                break;
                            }
                        }

                        if (!flag) return callback('Sheet not found...')

                        const getRows = await googleSheets.spreadsheets.values.get({
                            auth,
                            spreadsheetId: user._gsSessionData,
                            range: sheetName,
                        });

                        var data = getRows.data;

                        for (let index = 0; index < data.values.length; index++) {
                            const element = data.values[index];
                            const chatNumber = `${element[4]}@c.us`

                            const checkChat = (chat) => {
                                return chat.chatNumber === chatNumber;
                            }
                            if (user._wpChats.find(checkChat)) {
                                element.push('auth')
                            } else {
                                element.push('unauth')
                            }
                        }

                        socket.emit("got_sheets_data", { password: process.env.CLIENT_SOCKET_PASSWORD, data })
                    }

                }
            } catch (err) {
                console.log(err)
            }
        })

        socket.on("add_chat_to_dir", async ({ authToken, password, directoryId, chatDetails }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (user._wpIntegration && user._wpSessionData !== "") {
                        const { existingChat, chatGettingErr } = await getChat({ chatId: chatDetails.chatId })
                        if (chatGettingErr) return callback(chatGettingErr)

                        if (existingChat._chatParent !== id) return callback('Chat authentication failed...')

                        if (user._directories.length <= 0) return callback('Create some directories...')
                        if (user._directories.length > 0) {
                            const checkDirectory = (directory) => {
                                return directory.directoryId === directoryId
                            }
                            if (!user._directories.find(checkDirectory)) return callback('No such directory found...')

                            const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId })
                            if (directoryGettingErr) return callback(directoryGettingErr)
                            if (existingdirectory._directoryParent !== id) return callback('Directory authentication failed')

                            const directoryChats = existingdirectory._directoryChats

                            const directoryUpdates = {
                                _directoryChats: [...directoryChats, {
                                    data: [{
                                        field: chatDetails.date,
                                    }, {
                                        field: chatDetails.platform
                                    }, {
                                        field: chatDetails.name
                                    }, {
                                        field: chatDetails.email
                                    }, {
                                        field: chatDetails.number
                                    }, {
                                        field: chatDetails.campaign
                                    }, {
                                        field: chatDetails.business
                                    }, {
                                        field: chatDetails.objective
                                    }]
                                }],
                            }
                            const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                            if (directoryUpdationErr) return callback(directoryUpdationErr);

                            const chatUpdates = {
                                _chatDirectory: updatedDirectory._directoryName
                            }
                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId: chatDetails.chatId, chatUpdates })
                            if (chatUpdationErr) return callback(chatUpdationErr)

                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                            return callback()
                        }
                    }
                } else {
                    return callback('Access denied')
                }
            } catch (err) {
                console.log(err)
            }
        })

        socket.on("get_chat_details", async ({ authToken, password, chatNumber, origin }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkChat = (chat) => {
                        return chat.chatNumber === chatNumber;
                    }
                    if (!user._wpChats.find(checkChat)) return callback('Chat not found...')

                    if (origin) {
                        if (user._wpChats.find(checkChat)) {
                            const getChatDetails = (chat) => {
                                if (chat.chatNumber === chatNumber) {
                                    return chat
                                }
                            }
                            const foundChat = user._wpChats.find(getChatDetails);

                            const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                            if (chatGettingErr) return callback(chatGettingErr)

                            if (existingChat._chatParent !== id && existingChat._chatHandlerId !== id && existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')
                            console.log({ existingChat })

                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: existingChat })
                            return callback()
                        }
                    } else {
                        if (user._wpChats.find(checkChat)) {
                            const getChatDetails = (chat) => {
                                if (chat.chatNumber === chatNumber) {
                                    return chat
                                }
                            }
                            const foundChat = user._wpChats.find(getChatDetails);

                            const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                            if (chatGettingErr) return callback(chatGettingErr)

                            if (existingChat._chatParent !== id && existingChat._chatHandlerId !== id && existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')

                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: existingChat })
                            return callback()
                        }
                    }

                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("get_funnel_details", async ({ authToken, password, funnelId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkFunnel = (funnel) => {
                        return funnel.funnelId === funnelId;
                    }
                    if (!user._funnels.find(checkFunnel)) return callback('Funnel not found...')

                    const getFunnelDetails = (funnel) => {
                        if (funnel.funnelId === funnelId) {
                            return funnel
                        }
                    }
                    const foundFunnel = user._funnels.find(getFunnelDetails);

                    const { existingFunnel, funnelGettingErr } = await getFunnels({ funnelId: foundFunnel.funnelId })
                    if (funnelGettingErr) return callback(funnelGettingErr)

                    if (existingFunnel._funnelParent !== id) return callback('Funnel authentication failed...')

                    socket.emit("got_funnel_details", { password: process.env.CLIENT_SOCKET_PASSWORD, funnel: existingFunnel })
                    return callback()

                } else {
                    return callback('Access denied...')
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("add_chat", async ({ authToken, password, chatDetails }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (user._wpIntegration && user._wpSessionData !== "") {
                        const checkChat = (chat) => {
                            return chat.chatNumber === chatDetails.number;
                        }
                        if (user._wpChats.find(checkChat)) return callback('Chat already exists...')

                        else if (!user._wpChats.find(checkChat)) {
                            const { newChat, chatCreateErr } = await createChat({ chatName: chatDetails.name, chatNumber: chatDetails.number, chatEmail: chatDetails.email, chatObjective: chatDetails.objective, chatCampaign: chatDetails.campaign, chatBusiness: chatDetails.business, chatPlatform: 'crm', chatParent: id })
                            if (chatCreateErr) return callback(chatCreateErr)

                            const { user, error } = await getUsers({ id });
                            if (error) return callback(error);

                            const userUpdates = {
                                _wpChats: [...user._wpChats, {
                                    chatName: newChat._chatName,
                                    chatNumber: newChat._chatNumber,
                                    chatId: newChat._id,
                                    chatLabel: newChat._chatLabel
                                }]
                            }
                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                            if (errrrr) return callback(errrrr);


                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: newChat })
                        }
                    }
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("delete_chat", async ({ authToken, password, chatNumber, origin }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    console.log("Deleting Chat")

                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    const checkChat = (chat) => {
                        return chat.chatNumber === chatNumber;
                    }
                    const getChatDetails = (chat) => {
                        if (chat.chatNumber === chatNumber) {
                            return chat
                        }
                    }
                    const chat = user._wpChats.find(getChatDetails)
                    if (!user._wpChats.find(checkChat)) return callback('Chat authentication failed...')
                    console.log("Deleting Chat")

                    const { existingChat, chatGettingErr } = await getChat({ chatId: chat.chatId })
                    if (chatGettingErr) return callback(chatGettingErr)

                    if (origin) {
                        if (user._wpChats.find(checkChat)) {
                            const chat = user._wpChats.find(getChatDetails);

                            var ownChats = user._wpChats
                            var chatId = JSON.stringify(chat.chatId)
                            for (let index = 0; index < ownChats.length; index++) {
                                const element = ownChats[index];
                                if (`"${element.chatId}"` === chatId) {
                                    ownChats.splice(index, 1)
                                    break;
                                }
                            }

                            const userUpdates = {
                                _wpChats: [...ownChats],
                            }
                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                            if (errrrr) return callback(errrrr);

                            const chatUpdates = {
                                _chatHandlerId: "",
                                _chatHandlerName: 'You'
                            }
                            const { updatedChat, chatUpdatingErr } = await updateChat({ chatId: chat.chatId, chatUpdates })
                            if (chatUpdatingErr) return callback(chatUpdatingErr)

                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                            socket.emit("chat_deleted", { password: process.env.CLIENT_SOCKET_PASSWORD })
                            io.to(updatedUser._teamId).emit("got_chat_details_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedChat._chatParent })
                            return callback()
                        }
                    } else {
                        if (user._wpChats.find(checkChat) && existingChat._chatHandlerId === id) {
                            const { deletedChat, chatDeletionErr } = await deleteChat({ chatId: chat.chatId })
                            if (chatDeletionErr) return callback(chatDeletionErr)


                            var ownChats = user._wpChats
                            var chatId = JSON.stringify(deletedChat._id)
                            for (let index = 0; index < ownChats.length; index++) {
                                const element = ownChats[index];
                                if (`"${element.chatId}"` === chatId) {
                                    ownChats.splice(index, 1)
                                    break;
                                }
                            }

                            const userUpdates = {
                                _wpChats: [...ownChats],
                            }
                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                            if (errrrr) return callback(errrrr);

                            if (deletedChat._chatHandlerId !== "" && deletedChat._chatHandlerId !== id) {
                                const chatHandler = await getUsers({ id: deletedChat._chatHandlerId })
                                if (chatHandler.error) return callback(chatHandler.error)

                                var ownChats = chatHandler.user._wpChats
                                var chatId = JSON.stringify(deletedChat._id)
                                for (let index = 0; index < ownChats.length; index++) {
                                    const element = ownChats[index];
                                    if (`"${element.chatId}"` === chatId) {
                                        ownChats.splice(index, 1)
                                        break;
                                    }
                                }

                                const userUpdates = {
                                    _wpChats: [...ownChats],
                                }
                                const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                if (errrrr) return callback(errrrr);

                                io.to(updatedUser._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                io.to(updatedUser._teamId).emit("chat_deleted_by_admin", { password: process.env.CLIENT_SOCKET_PASSWORD, target: updatedUser._id })
                            }

                            const userFunnels = user._funnels;
                            for (let index = 0; index < userFunnels.length; index++) {
                                const funnel = userFunnels[index];

                                const { existingFunnel, funnelGettingErr } = await getFunnels({ funnelId: funnel.funnelId })
                                if (funnelGettingErr) return callback(funnelGettingErr)

                                const funnelChats = existingFunnel._funnelChats
                                if (funnelChats.find(checkChat)) {
                                    var chatId = JSON.stringify(deletedChat._id)
                                    for (let index = 0; index < funnelChats.length; index++) {
                                        const element = funnelChats[index];
                                        if (`"${element.chatId}"` === chatId) {
                                            funnelChats.splice(index, 1)
                                            break;
                                        }
                                    }
                                    console.log({ funnelChats })

                                    const funnelStages = existingFunnel._funnelStages
                                    var updatedFunnelStages = []
                                    for (let index = 0; index < funnelStages.length; index++) {
                                        const stage = funnelStages[index];

                                        const stageChats = stage._stageChats
                                        if (stageChats.find(checkChat)) {
                                            var chatId = JSON.stringify(deletedChat._id)
                                            for (let index = 0; index < stageChats.length; index++) {
                                                const element = stageChats[index];
                                                if (`"${element.chatId}"` === chatId) {
                                                    stageChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            updatedFunnelStages.push({
                                                _stageName: stage._stageName,
                                                _stageChats: stageChats
                                            })
                                        } else {
                                            updatedFunnelStages.push({
                                                _stageName: stage._stageName,
                                                _stageChats: stage._stageChats
                                            })
                                        }
                                    }
                                    console.log({ updatedFunnelStages })

                                    const funnelUpdates = {
                                        _funnelChats: funnelChats,
                                        _funnelStages: updatedFunnelStages
                                    }
                                    const { updatedFunnel, funnelUpdationErr } = await updateFunnels({ funnelId: existingFunnel._id, funnelUpdates })
                                    if (funnelUpdationErr) return callback(funnelUpdationErr)
                                }
                            }

                            const userDirectories = user._directories
                            for (let index = 0; index < userDirectories.length; index++) {
                                const element = userDirectories[index];

                                const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                if (directoryGettingErr) return callback(directoryGettingErr)
                                if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                var directoryChats = existingdirectory._directoryChats
                                for (let index = 0; index < directoryChats.length; index++) {
                                    const element = directoryChats[index].data;
                                    if (`${element[4].field}@c.us` === chatNumber) {
                                        console.log(directoryChats.splice(index, 1))
                                        break;
                                    }
                                }

                                const directoryUpdates = {
                                    _directoryChats: [...directoryChats],
                                }
                                const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                if (directoryUpdationErr) return callback(directoryUpdationErr);
                            }

                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                            socket.emit("chat_deleted", { password: process.env.CLIENT_SOCKET_PASSWORD })
                            return callback()
                        }
                    }

                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("delete_funnel", async ({ authToken, password, funnelId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    console.log("Got Request to delete funnel")
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkFunnel = (funnel) => {
                        return funnel.funnelId === funnelId
                    }
                    if (!user._funnels.find(checkFunnel)) return callback('Funnel not found...')

                    const { deletedFunnel, funnelDeletionErr } = await deleteFunnels({ funnelId })
                    if (funnelDeletionErr) return callback(funnelDeletionErr)

                    var ownFunnels = user._funnels
                    var funnelId = JSON.stringify(deletedFunnel._id)
                    for (let index = 0; index < ownFunnels.length; index++) {
                        const element = ownFunnels[index];
                        if (`"${element.funnelId}"` === funnelId) {
                            ownFunnels.splice(index, 1)
                            break;
                        }
                    }

                    const userUpdates = {
                        _funnels: [...ownFunnels],
                    }
                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                    if (errrrr) return callback(errrrr);

                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                    socket.emit("funnel_deleted", { password: process.env.CLIENT_SOCKET_PASSWORD })
                    return callback()
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("delete_stage", async ({ authToken, password, funnelId, stageId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    console.log("Got Request to delete funnel")
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkFunnel = (funnel) => {
                        return funnel.funnelId === funnelId
                    }
                    if (!user._funnels.find(checkFunnel)) return callback('Funnel not found...')

                    const { existingFunnel, funnelGettingErr } = await getFunnels({ funnelId })
                    if (funnelGettingErr) return callback(funnelGettingErr)

                    var funnelChats = existingFunnel._funnelChats
                    var ownStages = existingFunnel._funnelStages
                    for (let index = 0; index < ownStages.length; index++) {
                        const element = ownStages[index];
                        if (`"${stageId}"` === JSON.stringify(element._id)) {
                            const stageChats = element._stageChats
                            for (let index = 0; index < stageChats.length; index++) {
                                const chat = stageChats[index];

                                const checkChatInFunnel = (chatData) => {
                                    return chat.chatNumber === chatData.chatNumber
                                }
                                if (funnelChats.find(checkChatInFunnel)) {
                                    for (let index = 0; index < funnelChats.length; index++) {
                                        const funnelChat = funnelChats[index];
                                        if (funnelChat.chatNumber === chat.chatNumber) {
                                            funnelChats.splice(index, 1)
                                            break;
                                        }
                                    }
                                }
                            }

                            ownStages.splice(index, 1)
                            break;
                        }
                    }


                    const funnelUpdates = {
                        _funnelStages: [...ownStages],
                        _funnelChats: [...funnelChats]
                    }
                    const { updatedFunnel, funnelUpdationErr } = await updateFunnels({ funnelId, funnelUpdates })
                    if (funnelUpdationErr) return callback(funnelUpdationErr);

                    socket.emit("got_funnel_details", { password: process.env.CLIENT_SOCKET_PASSWORD, funnel: updatedFunnel })
                    socket.emit("stage_deleted", { password: process.env.CLIENT_SOCKET_PASSWORD })
                    return callback()
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("delete_chat_from_stage", async ({ authToken, password, funnelId, stageId, chatNumber }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    console.log("Got Request to delete chat")
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkFunnel = (funnel) => {
                        return funnel.funnelId === funnelId
                    }
                    if (!user._funnels.find(checkFunnel)) return callback('Funnel not found...')

                    const { existingFunnel, funnelGettingErr } = await getFunnels({ funnelId })
                    if (funnelGettingErr) return callback(funnelGettingErr)

                    var funnelChats = existingFunnel._funnelChats
                    var ownStages = existingFunnel._funnelStages
                    var newStages = []
                    for (let index = 0; index < ownStages.length; index++) {
                        const element = ownStages[index];
                        if (`"${stageId}"` === JSON.stringify(element._id)) {
                            var stageChats = element._stageChats
                            for (let index = 0; index < stageChats.length; index++) {
                                const chat = stageChats[index];
                                if (chat.chatNumber === chatNumber) {
                                    stageChats.splice(index, 1)
                                    break;
                                }
                            }

                            const checkChatInFunnel = (chatData) => {
                                return chatNumber === chatData.chatNumber
                            }
                            if (funnelChats.find(checkChatInFunnel)) {
                                for (let index = 0; index < funnelChats.length; index++) {
                                    const funnelChat = funnelChats[index];
                                    if (funnelChat.chatNumber === chatNumber) {
                                        const chatUpdates = {
                                            _chatFunnel: "None"
                                        }
                                        const { updatedChat } = await updateChat({ chatId: funnelChat.chatId, chatUpdates })
                                        socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                        io.to(user._teamId).emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedChat._chatHandlerId })

                                        funnelChats.splice(index, 1)
                                        break;
                                    }
                                }
                            }

                            newStages.push({
                                _stageName: element._stageName,
                                _stageChats: [...stageChats]
                            })
                            break;
                        } else {
                            newStages.push(element)
                        }
                    }


                    const funnelUpdates = {
                        _funnelStages: [...newStages],
                        _funnelChats: [...funnelChats]
                    }
                    const { updatedFunnel, funnelUpdationErr } = await updateFunnels({ funnelId, funnelUpdates })
                    if (funnelUpdationErr) return callback(funnelUpdationErr);

                    socket.emit("got_funnel_details", { password: process.env.CLIENT_SOCKET_PASSWORD, funnel: updatedFunnel })
                    socket.emit("chat_deleted", { password: process.env.CLIENT_SOCKET_PASSWORD })
                    return callback()
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("update_chat", async ({ origin, authToken, password, chatUpdates, chatNumber }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);
                    var chatUpdated = false

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    const checkChat = (chat) => {
                        return chat.chatNumber === chatNumber;
                    }
                    const getChatDetails = (chat) => {
                        if (chat.chatNumber === chatNumber) return chat
                    }
                    if (!user._wpChats.find(checkChat)) return callback('Chat authentication failed...')

                    if (origin) {
                        if (user._wpChats.find(checkChat)) {
                            const chat = user._wpChats.find(getChatDetails)
                            var globalChat;
                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId: chat.chatId, chatUpdates })
                            if (chatUpdationErr) return callback(chatUpdationErr)

                            globalChat = updatedChat

                            var chatDetails;
                            var ownChats = user._wpChats
                            var chatId = JSON.stringify(globalChat._id)
                            for (let index = 0; index < ownChats.length; index++) {
                                const element = ownChats[index];
                                if (`"${element.chatId}"` === chatId) {
                                    chatDetails = ownChats.splice(index, 1)
                                    break;
                                }
                            }

                            if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                if (chatHandler.error) return callback(chatHandler.error)

                                var chatDetails;
                                var ownChats2 = chatHandler.user._wpChats
                                var chatId = JSON.stringify(updatedChat._id)
                                for (let index = 0; index < ownChats2.length; index++) {
                                    const element = ownChats2[index];
                                    if (`"${element.chatId}"` === chatId) {
                                        chatDetails = ownChats2.splice(index, 1)
                                        break;
                                    }
                                }

                                const userUpdates = {
                                    _wpChats: [{
                                        chatName: updatedChat._chatName,
                                        chatNumber: chatDetails[0].chatNumber,
                                        chatId: chatDetails[0].chatId,
                                        lastMessage: chatDetails[0].lastMessage,
                                        from: chatDetails[0].from,
                                        chatLabel: updatedChat._chatLabel
                                    }, ...ownChats2],
                                }
                                const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                if (errrrr) return callback(errrrr);

                                io.to(updatedUser._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                io.to(updatedUser._teamId).emit("got_chat_details_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                            } else if (updatedChat._chatHandlerId === id && updatedChat._chatHandlerId !== "") {
                                const chatHandler = await getUsers({ id: globalChat._chatParent })
                                if (chatHandler.error) return callback(chatHandler.error)

                                var chatDetails;
                                var ownChats2 = chatHandler.user._wpChats
                                var chatId = JSON.stringify(globalChat._id)
                                for (let index = 0; index < ownChats2.length; index++) {
                                    const element = ownChats2[index];
                                    if (`"${element.chatId}"` === chatId) {
                                        chatDetails = ownChats2.splice(index, 1)
                                        break;
                                    }
                                }

                                const userDirectories = chatHandler.user._directories
                                for (let index = 0; index < userDirectories.length; index++) {
                                    const element = userDirectories[index];

                                    const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                    if (directoryGettingErr) return callback(directoryGettingErr)
                                    if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                    var directoryChats = existingdirectory._directoryChats
                                    for (let index = 0; index < directoryChats.length; index++) {
                                        const element = directoryChats[index].data;
                                        if (`${element[4].field}@c.us` === chatNumber) {
                                            directoryChats.splice(index, 1)
                                            break;
                                        }
                                    }

                                    const directoryUpdates = {
                                        _directoryChats: [...directoryChats, {
                                            data: [{
                                                field: globalChat._chatDate
                                            }, {
                                                field: globalChat._chatPlatform
                                            }, {
                                                field: globalChat._chatName
                                            }, {
                                                field: globalChat._chatEmail
                                            }, {
                                                field: globalChat._chatNumber.substring(0, globalChat._chatNumber.indexOf('@'))
                                            }, {
                                                field: globalChat._chatCampaign
                                            }, {
                                                field: globalChat._chatBusiness
                                            }, {
                                                field: globalChat._chatObjective
                                            },]
                                        }],
                                    }
                                    const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                    if (directoryUpdationErr) return callback(directoryUpdationErr);
                                }

                                const userUpdates = {
                                    _wpChats: [{
                                        chatName: globalChat._chatName,
                                        chatNumber: chatDetails[0].chatNumber,
                                        chatId: chatDetails[0].chatId,
                                        lastMessage: chatDetails[0].lastMessage,
                                        from: chatDetails[0].from,
                                        chatLabel: globalChat._chatLabel
                                    }, ...ownChats2],
                                }
                                const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                if (errrrr) return callback(errrrr);

                                io.to(updatedUser._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                io.to(updatedUser._teamId).emit("got_chat_details_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: globalChat, target: updatedUser._id })
                            }

                            const userUpdates = {
                                _wpChats: [{
                                    chatName: globalChat._chatName,
                                    chatNumber: chatDetails[0].chatNumber,
                                    chatId: chatDetails[0].chatId,
                                    lastMessage: chatDetails[0].lastMessage,
                                    from: chatDetails[0].from,
                                    chatLabel: globalChat._chatLabel
                                }, ...ownChats],
                            }
                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                            if (errrrr) return callback(errrrr);

                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: globalChat })
                            return callback()
                        }
                    } else {
                        if (user._wpChats.find(checkChat)) {
                            const chat = user._wpChats.find(getChatDetails)
                            var globalChat;
                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId: chat.chatId, chatUpdates })
                            if (chatUpdationErr) return callback(chatUpdationErr)

                            globalChat = updatedChat

                            var chatDetails;
                            var ownChats = user._wpChats
                            var chatId = JSON.stringify(globalChat._id)
                            for (let index = 0; index < ownChats.length; index++) {
                                const element = ownChats[index];
                                if (`"${element.chatId}"` === chatId) {
                                    chatDetails = ownChats.splice(index, 1)
                                    break;
                                }
                            }

                            if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                if (chatHandler.error) return callback(chatHandler.error)

                                var chatDetails;
                                var ownChats2 = chatHandler.user._wpChats
                                var chatId = JSON.stringify(updatedChat._id)
                                for (let index = 0; index < ownChats2.length; index++) {
                                    const element = ownChats2[index];
                                    if (`"${element.chatId}"` === chatId) {
                                        chatDetails = ownChats2.splice(index, 1)
                                        break;
                                    }
                                }

                                const userUpdates = {
                                    _wpChats: [{
                                        chatName: updatedChat._chatName,
                                        chatNumber: chatDetails[0].chatNumber,
                                        chatId: chatDetails[0].chatId,
                                        lastMessage: chatDetails[0].lastMessage,
                                        from: chatDetails[0].from,
                                        chatLabel: updatedChat._chatLabel
                                    }, ...ownChats2],
                                }
                                const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                if (errrrr) return callback(errrrr);

                                io.to(updatedUser._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                io.to(updatedUser._teamId).emit("got_chat_details_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                            } else if (updatedChat._chatHandlerId === id && updatedChat._chatHandlerId !== "") {
                                const chatHandler = await getUsers({ id: globalChat._chatParent })
                                if (chatHandler.error) return callback(chatHandler.error)

                                var chatDetails;
                                var ownChats2 = chatHandler.user._wpChats
                                var chatId = JSON.stringify(globalChat._id)
                                for (let index = 0; index < ownChats2.length; index++) {
                                    const element = ownChats2[index];
                                    if (`"${element.chatId}"` === chatId) {
                                        chatDetails = ownChats2.splice(index, 1)
                                        break;
                                    }
                                }

                                const userDirectories = chatHandler.user._directories
                                for (let index = 0; index < userDirectories.length; index++) {
                                    const element = userDirectories[index];

                                    const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                    if (directoryGettingErr) return callback(directoryGettingErr)
                                    if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                    var directoryChats = existingdirectory._directoryChats
                                    for (let index = 0; index < directoryChats.length; index++) {
                                        const element = directoryChats[index].data;
                                        if (`${element[4].field}@c.us` === chatNumber) {
                                            directoryChats.splice(index, 1)
                                            break;
                                        }
                                    }

                                    const directoryUpdates = {
                                        _directoryChats: [...directoryChats, {
                                            data: [{
                                                field: globalChat._chatDate
                                            }, {
                                                field: globalChat._chatPlatform
                                            }, {
                                                field: globalChat._chatName
                                            }, {
                                                field: globalChat._chatEmail
                                            }, {
                                                field: globalChat._chatNumber.substring(0, globalChat._chatNumber.indexOf('@'))
                                            }, {
                                                field: globalChat._chatCampaign
                                            }, {
                                                field: globalChat._chatBusiness
                                            }, {
                                                field: globalChat._chatObjective
                                            },]
                                        }],
                                    }
                                    const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                    if (directoryUpdationErr) return callback(directoryUpdationErr);
                                }

                                const userUpdates = {
                                    _wpChats: [{
                                        chatName: globalChat._chatName,
                                        chatNumber: chatDetails[0].chatNumber,
                                        chatId: chatDetails[0].chatId,
                                        lastMessage: chatDetails[0].lastMessage,
                                        from: chatDetails[0].from,
                                        chatLabel: globalChat._chatLabel
                                    }, ...ownChats2],
                                }
                                const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                if (errrrr) return callback(errrrr);

                                io.to(updatedUser._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                io.to(updatedUser._teamId).emit("got_chat_details_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: globalChat, target: updatedUser._id })
                            }

                            const userUpdates = {
                                _wpChats: [{
                                    chatName: globalChat._chatName,
                                    chatNumber: chatDetails[0].chatNumber,
                                    chatId: chatDetails[0].chatId,
                                    lastMessage: chatDetails[0].lastMessage,
                                    from: chatDetails[0].from,
                                    chatLabel: globalChat._chatLabel
                                }, ...ownChats],
                            }
                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                            if (errrrr) return callback(errrrr);

                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: globalChat })
                            return callback()
                        }
                    }

                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("update_user", async ({ authToken, password, userUpdates }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                    if (errrrr) return callback(errrrr);
                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                    return callback()

                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("update_chat_from_dir", async ({ authToken, password, chatUpdates, chatNumber }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    if (user._wpIntegration && user._wpSessionData !== "") {
                        const checkChat = (chat) => {
                            return chat.chatNumber === chatNumber;
                        }
                        const chat = user._wpChats.find(checkChat)
                        if (!user._wpChats.find(checkChat)) return callback('Chat authentication failed...')

                        else if (user._wpChats.find(checkChat)) {
                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId: chat.chatId, chatUpdates })
                            if (chatUpdationErr) return callback(chatUpdationErr)

                            var chatDetails;
                            var ownChats = user._wpChats
                            var chatId = JSON.stringify(updatedChat._id)
                            for (let index = 0; index < ownChats.length; index++) {
                                const element = ownChats[index];
                                if (`"${element.chatId}"` === chatId) {
                                    chatDetails = ownChats.splice(index, 1)
                                    break;
                                }
                            }

                            const userDirectories = user._directories
                            for (let index = 0; index < userDirectories.length; index++) {
                                const element = userDirectories[index];

                                const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                if (directoryGettingErr) return callback(directoryGettingErr)
                                if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                var directoryChats = existingdirectory._directoryChats
                                for (let index = 0; index < directoryChats.length; index++) {
                                    const element = directoryChats[index].data;
                                    if (`${element[4].field}@c.us` === chatNumber) {
                                        directoryChats.splice(index, 1)
                                        break;
                                    }
                                }

                                const directoryUpdates = {
                                    _directoryChats: [...directoryChats, {
                                        data: [{
                                            field: updatedChat._chatDate
                                        }, {
                                            field: updatedChat._chatPlatform
                                        }, {
                                            field: updatedChat._chatName
                                        }, {
                                            field: updatedChat._chatEmail
                                        }, {
                                            field: updatedChat._chatNumber.substring(0, updatedChat._chatNumber.indexOf('@'))
                                        }, {
                                            field: updatedChat._chatCampaign
                                        }, {
                                            field: updatedChat._chatBusiness
                                        }, {
                                            field: updatedChat._chatObjective
                                        },]
                                    }],
                                }
                                const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                if (directoryUpdationErr) return callback(directoryUpdationErr);
                                console.log(directoryUpdates)
                            }

                            const userUpdates = {
                                _wpChats: [{
                                    chatName: updatedChat._chatName,
                                    chatNumber: chatDetails[0].chatNumber,
                                    chatId: chatDetails[0].chatId,
                                    lastMessage: chatDetails[0].lastMessage,
                                    from: chatDetails[0].from,
                                    chatLabel: updatedChat._chatLabel
                                }, ...ownChats],
                            }
                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                            if (errrrr) return callback(errrrr);

                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                            return callback()
                        }
                    }
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("add_funnel", async ({ authToken, password, funnelName }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const { newFunnel, funnelCreationErr } = await addFunnels({ funnelName, funnelParent: id, userChats: [] })
                    if (funnelCreationErr) return callback(funnelCreationErr)

                    const funnels = user._funnels
                    const userUpdates = {
                        _funnels: [{
                            funnelName: newFunnel._funnelName,
                            funnelId: newFunnel._id
                        }, ...funnels],
                    }
                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                    if (errrrr) return callback(errrrr);


                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                    socket.emit("funnel_created", { password: process.env.CLIENT_SOCKET_PASSWORD, newFunnel })
                    return callback()
                } else {
                    return callback('Access Denied...')
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("update_funnel", async ({ authToken, password, funnelId, funnelUpdates }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const { updatedFunnel, funnelUpdationErr } = await updateFunnels({ funnelId, funnelUpdates })
                    if (funnelUpdationErr) return callback(funnelUpdationErr)

                    socket.emit("funnel_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedFunnel })
                    return callback()
                } else {
                    return callback('Access Denied...')
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("add_chat_to_funnel", async ({ authToken, password, funnelId, chatId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkFunnel = (funnel) => {
                        return funnel.funnelId === funnelId
                    }
                    if (!user._funnels.find(checkFunnel)) return ('Funnel authentication failed...')

                    const { existingFunnel, funnelGettingErr } = await getFunnels({ funnelId })
                    if (funnelGettingErr) return callback(funnelGettingErr)

                    if (!funnelGettingErr) {
                        const checkFunnelChat = (chat) => {
                            return chat.chatId === chatId
                        }
                        if (!existingFunnel._funnelChats.find(checkFunnelChat)) {
                            const { existingChat, chatGettingErr } = await getChat({ chatId })
                            if (chatGettingErr) return callback(chatGettingErr)

                            if (user._teamRole !== 'neutral') {
                                if (existingChat._chatParent !== id && existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')
                            } else {
                                if (existingChat._chatParent !== id) return callback('Chat authentication failed...')
                            }

                            var inboxStage;
                            var stages = existingFunnel._funnelStages
                            for (let index = 0; index < stages.length; index++) {
                                const element = stages[index];
                                if (element._stageName === "Inbox") {
                                    inboxStage = stages.splice(index, 1)
                                    break;
                                }
                            }

                            var inboxChats = inboxStage[0]._stageChats

                            const existingFunnelChats = existingFunnel._funnelChats
                            const funnelUpdates = {
                                _funnelChats: [{
                                    chatName: existingChat._chatName,
                                    chatNumber: existingChat._chatNumber,
                                    chatId: existingChat._id,
                                    lastMessage: existingChat._chatMessages[existingChat._chatMessages.length - 1].data,
                                    from: existingChat._chatMessages[existingChat._chatMessages.length - 1].from,
                                    chatLabel: existingChat._chatLabel
                                }, ...existingFunnelChats],
                                _funnelStages: [{
                                    _stageName: 'Inbox',
                                    _stageChats: [{
                                        chatName: existingChat._chatName,
                                        chatNumber: existingChat._chatNumber,
                                        chatId: existingChat._id,
                                        lastMessage: existingChat._chatMessages[existingChat._chatMessages.length - 1].data,
                                        from: existingChat._chatMessages[existingChat._chatMessages.length - 1].from,
                                        chatLabel: existingChat._chatLabel
                                    }, ...inboxChats]
                                }, ...stages]
                            }
                            const { updatedFunnel, funnelUpdationErr } = await updateFunnels({ funnelId: existingFunnel._id, funnelUpdates })

                            const chatUpdates = {
                                _chatFunnel: updatedFunnel._funnelName
                            }
                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId, chatUpdates })
                            if (chatUpdationErr) return callback(chatUpdationErr)

                            if (!funnelUpdationErr) {
                                socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                return callback()
                            } else {
                                return callback(funnelUpdationErr)
                            }
                        } else {
                            return callback('Chat already exixting in the funnel')
                        }
                    }

                } else {
                    return callback('Access Denied...')
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("add_stage", async ({ authToken, password, funnelId, stageName }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkFunnel = (funnel) => {
                        return funnel.funnelId === funnelId
                    }
                    if (!user._funnels.find(checkFunnel)) return ('Funnel authentication failed...')

                    const { existingFunnel, funnelGettingErr } = await getFunnels({ funnelId })
                    if (funnelGettingErr) return callback(funnelGettingErr)

                    const funnelStages = existingFunnel._funnelStages
                    const funnelUpdates = {
                        _funnelStages: [...funnelStages, {
                            _stageName: stageName,
                            _stageChats: []
                        }]
                    }
                    const { updatedFunnel, funnelUpdationErr } = await updateFunnels({ funnelId, funnelUpdates })
                    if (funnelUpdationErr) return callback(funnelUpdationErr)

                    socket.emit('got_funnel_details', { password: process.env.CLIENT_SOCKET_PASSWORD, funnel: updatedFunnel })
                    return callback()
                } else {
                    return callback('Access Denied...')
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("update_chat_funnel", async ({ authToken, password, funnelId, chatId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkFunnel = (funnel) => {
                        return funnel.funnelId === funnelId
                    }
                    if (!user._funnels.find(checkFunnel)) return ('Funnel authentication failed...')

                    const { existingFunnel, funnelGettingErr } = await getFunnels({ funnelId })
                    if (funnelGettingErr) return callback(funnelGettingErr)

                    const { existingChat, chatGettingErr } = await getChat({ chatId })

                    if (existingFunnel._funnelStages.length < 2) return callback('Create a stage first...')
                    if (user._teamRole !== 'neutral') {
                        if (existingChat._chatParent !== id && existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')
                    } else {
                        if (existingChat._chatParent !== id) return callback('Chat authentication failed...')
                    }

                    for (let index = 0; index < existingFunnel._funnelStages.length; index++) {
                        const element = existingFunnel._funnelStages[index];

                        const checkChat = (chat) => {
                            return chat.chatId === chatId;
                        }
                        if (element._stageChats.find(checkChat)) {
                            var chatDetails;
                            var stageChats = element._stageChats
                            for (let index2 = 0; index2 < stageChats.length; index2++) {
                                const chatToBeUpdated = stageChats[index2];
                                if (chatToBeUpdated.chatId === chatId) {
                                    chatDetails = stageChats.splice(index2, 1)
                                    break;
                                }
                            }

                            var stageFromUpdated = existingFunnel._funnelStages[index]
                            const stageFrom = stageFromUpdated._stageName
                            stageFromUpdated = {
                                _stageName: stageFromUpdated._stageName,
                                _stageChats: stageChats
                            }


                            var stageToBeUpdated = existingFunnel._funnelStages[index + 1]
                            const stageTo = stageToBeUpdated._stageName
                            const chatToAppend = stageToBeUpdated._stageChats
                            stageToBeUpdated = {
                                _stageName: stageToBeUpdated._stageName,
                                _stageChats: [{
                                    chatName: chatDetails[0].chatName,
                                    chatId: chatDetails[0].chatId,
                                    chatNumber: chatDetails[0].chatNumber,
                                    lastMessage: chatDetails[0].lastMessage,
                                    from: chatDetails[0].from,
                                    chatLabel: chatDetails[0].chatLabel,
                                }, ...chatToAppend]
                            }

                            var newStageArray = []
                            for (let index3 = 0; index3 < existingFunnel._funnelStages.length; index3++) {
                                const stage = existingFunnel._funnelStages[index3];

                                if (stage._stageName === stageFrom) {
                                    newStageArray.push(stageFromUpdated)
                                } else if (stage._stageName === stageTo) {
                                    newStageArray.push(stageToBeUpdated)
                                } else {
                                    newStageArray.push(stage)
                                }
                            }

                            const funnelUpdates = {
                                _funnelStages: newStageArray
                            }
                            const { updatedFunnel, funnelUpdationErr } = await updateFunnels({ funnelId, funnelUpdates })
                            if (funnelUpdationErr) return callback(funnelGettingErr)

                            socket.emit('got_funnel_details', { password: process.env.CLIENT_SOCKET_PASSWORD, funnel: updatedFunnel })
                            return callback()
                            break;
                        }
                    }
                } else {
                    return callback('Access Denied...')
                }
            } catch (err) {
                console.log(err)
                return callback("Internal server error...")
            }
        })

        socket.on("authenticate_facebook", async ({ authToken, password }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    if (!user._gsIntegration) return callback("Please integrate google sheets first...")

                    const userUpdates = {
                        _fbIntegration: true,
                        _fbSessionData: user._gsSessionData
                    }
                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                    if (errrrr) return callback(errrrr);

                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                    return callback()
                } else {
                    return callback('Access denied...')
                }
            } catch (error) {
                console.log(error)
                return callback('Internal server erorr...')
            }
        })

        socket.on("add_directory", async ({ authToken, password, directoryName, facebookIntegration, allIntegration, googlesheetname }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkDirectory = (directory) => {
                        return directory.directoryName === directoryName
                    }
                    if (user._directories.find(checkDirectory)) return callback('A directory with that name already exists...')
                    var newDirectory;
                    var updateduser;
                    var Data

                    if (googlesheetname) {
                        if (!user._gsIntegration) return callback('Googlesheets not integrated...')
                        const auth = new google.auth.GoogleAuth({
                            keyFile: "credentials.json",
                            scopes: "https://www.googleapis.com/auth/spreadsheets",
                        });

                        const client = await auth.getClient();
                        const googleSheets = google.sheets({ version: "v4", auth: client });

                        const metaData = await googleSheets.spreadsheets.get({
                            auth,
                            spreadsheetId: user._gsSessionData,
                        });
                        let sheets = [];
                        let index = 0;
                        metaData.data.sheets.forEach((element) => {
                            sheets[index] = element.properties.title;
                            index++;
                        });

                        var flag = false;
                        for (let i = 0; i < sheets.length; i++) {
                            const element = sheets[i];

                            if (element === googlesheetname) {
                                flag = true;
                                break;
                            }
                        }

                        if (!flag) return callback('Sheet not found...')

                        const getRows = await googleSheets.spreadsheets.values.get({
                            auth,
                            spreadsheetId: user._gsSessionData,
                            range: googlesheetname,
                        });

                        var data = getRows.data;
                        // for (let index = 0; index < data.values.length; index++) {
                        //     const element = data.values[index];
                        //     const chatNumber = `${element[4]}@c.us`

                        //     const checkChat = (chat) => {
                        //         return chat.chatNumber === chatNumber;
                        //     }
                        //     if (user._wpChats.find(checkChat)) {
                        //         element.push('auth')
                        //     } else {
                        //         element.push('unauth')
                        //     }
                        // }

                        var dataToBeUploded = []
                        for (let index = 0; index < data.values.length; index++) {
                            const element = data.values[index];

                            var dataTemp = []
                            for (let index2 = 0; index2 < element.length; index2++) {
                                const element2 = element[index2];
                                console.log(element2)
                                dataTemp.push({
                                    field: element2
                                })
                            }
                            dataToBeUploded.push({
                                data: dataTemp
                            })

                        }

                        const { newdirectory, directoryCreationErr } = await addDirectory({ directoryName, directoryParent: user._id, allIntegration, facebookIntegration, userChats: dataToBeUploded })
                        if (directoryCreationErr) return (directoryCreationErr)

                        var data = newdirectory._directoryChats
                        for (let index = 0; index < data.length; index++) {
                            const element = data[index];
                            const chatNumber = `${element.data[4].field}@c.us`

                            const checkChat = (chat) => {
                                return chat.chatNumber === chatNumber;
                            }
                            if (user._wpChats.find(checkChat)) {
                                element.data.push({
                                    field: 'auth'
                                })
                            } else {
                                element.data.push({
                                    field: 'unauth'
                                })
                            }
                        }

                        const directories = user._directories
                        const userUpdates = {
                            _directories: [{
                                directoryName: newdirectory._directoryName,
                                directoryId: newdirectory._id
                            }, ...directories],
                        }
                        const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                        if (errrrr) return callback(errrrr);

                        updateduser = updatedUser
                        newDirectory = newdirectory
                        Data = data
                    } else {
                        const { newdirectory, directoryCreationErr } = await addDirectory({
                            directoryName, directoryParent: user._id, allIntegration, facebookIntegration, userChats: [{
                                data: [{
                                    field: "FECHA"
                                }, {
                                    field: "PT"
                                }, {
                                    field: "NOMBRE"
                                }, {
                                    field: "CORREO"
                                }, {
                                    field: "TELEFONO"
                                }, {
                                    field: "CAMPAÑA"
                                }, {
                                    field: "NEGOCIO"
                                }, {
                                    field: "OBJETIVO"
                                }]
                            }]
                        })
                        if (directoryCreationErr) return (directoryCreationErr)

                        const directories = user._directories
                        const userUpdates = {
                            _directories: [{
                                directoryName: newdirectory._directoryName,
                                directoryId: newdirectory._id
                            }, ...directories],
                        }
                        const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                        if (errrrr) return callback(errrrr);

                        updateduser = updatedUser
                        newDirectory = newdirectory
                        Data = newdirectory._directoryChats
                    }
                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updateduser })
                    socket.emit("directory_added", { password: process.env.CLIENT_SOCKET_PASSWORD, Data, newDirectory })
                    return callback()
                }
            } catch (err) {
                console.log(err)
                return callback('Internal server erorr...')
            }
        })

        socket.on("get_directory", async ({ authToken, password, directoryId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    console.log({ directoryId })

                    const checkDirectory = (directory) => {
                        return directory.directoryId === directoryId
                    }
                    if (!user._directories.find(checkDirectory)) return callback('No such directory found...')

                    const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId })
                    if (directoryGettingErr) return callback(directoryGettingErr)
                    if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                    var data = existingdirectory._directoryChats
                    for (let index = 0; index < data.length; index++) {
                        const element = data[index];
                        const chatNumber = `${element.data[4].field}@c.us`

                        const checkChat = (chat) => {
                            return chat.chatNumber === chatNumber;
                        }
                        if (user._wpChats.find(checkChat)) {
                            element.data.push({
                                field: 'auth'
                            })
                        } else {
                            element.data.push({
                                field: 'unauth'
                            })
                        }
                    }

                    socket.emit("got_directory", { data, password: process.env.CLIENT_SOCKET_PASSWORD, data, existingdirectory })
                    return callback()
                }
            } catch (err) {
                console.log(err)
                return callback('Internal server error..')
            }
        })

        socket.on("delete_directory", async ({ authToken, password, directoryId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    console.log({ directoryId })

                    const checkDirectory = (directory) => {
                        return directory.directoryId === directoryId
                    }
                    if (!user._directories.find(checkDirectory)) return callback('No such directory found...')

                    const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId })
                    if (directoryGettingErr) return callback(directoryGettingErr)
                    if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                    const { deleteddirectory, directoryDeletionErr } = await deleteDirectory({ directoryId })
                    if (directoryDeletionErr) return callback(directoryDeletionErr)


                    var ownDirectories = user._directories
                    var directoryId = JSON.stringify(deleteddirectory._id)
                    for (let index = 0; index < ownDirectories.length; index++) {
                        const element = ownDirectories[index];
                        if (`"${element.directoryId}"` === directoryId) {
                            ownDirectories.splice(index, 1)
                            break;
                        }
                    }

                    const userUpdates = {
                        _directories: [...ownDirectories],
                    }
                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                    if (errrrr) return callback(errrrr);

                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                    socket.emit("directory_deleted", { password: process.env.CLIENT_SOCKET_PASSWORD })
                    return callback()
                }
            } catch (err) {
                console.log(err)
                return callback('Internal server error...')
            }
        })

        socket.on("delete_chat_from_dir", async ({ authToken, password, directoryId, chatNumber }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    const checkDirectory = (directory) => {
                        return directory.directoryId === directoryId
                    }
                    if (!user._directories.find(checkDirectory)) return callback('No such directory found...')

                    const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId })
                    if (directoryGettingErr) return callback(directoryGettingErr)
                    if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                    var directoryChats = existingdirectory._directoryChats
                    for (let index = 0; index < directoryChats.length; index++) {
                        const element = directoryChats[index].data;
                        if (`${element[4].field}@c.us` === chatNumber) {
                            const getChatId = (chat) => {
                                if (chat.chatNumber === chatNumber) {
                                    return chat.chatId
                                }
                            }
                            const chatId = user._wpChats.find(getChatId)

                            const chatUpdates = {
                                _chatDirectory: 'None'
                            }
                            console.log(chatId)
                            const { updatedChat } = await updateChat({ chatId, chatUpdates })
                            console.log(updatedChat)
                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                            io.to(user._teamId).emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedChat._chatHandlerId })

                            directoryChats.splice(index, 1)
                            break;
                        }
                    }

                    const directoryUpdates = {
                        _directoryChats: [...directoryChats],
                    }
                    const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                    if (directoryUpdationErr) return callback(directoryUpdationErr);


                    var data = updatedDirectory._directoryChats
                    for (let index = 0; index < data.length; index++) {
                        const element = data[index];
                        const chatNumber = `${element.data[4].field}@c.us`

                        const checkChat = (chat) => {
                            return chat.chatNumber === chatNumber;
                        }
                        if (user._wpChats.find(checkChat)) {
                            element.data.push({
                                field: 'auth'
                            })
                        } else {
                            element.data.push({
                                field: 'unauth'
                            })
                        }
                    }

                    socket.emit("directory_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, existingdirectory: updatedDirectory, data })
                    socket.emit("chat_deleted_from_dir", { password: process.env.CLIENT_SOCKET_PASSWORD })
                    return callback()
                }
            } catch (err) {
                console.log(err)
                return callback('Internal server error...')
            }
        })

        socket.on("assign_chat_to_member", async ({ authToken, password, memberId, chatId }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    if (user._teamRole !== 'admin' || user._teamId === "") return callback('User team authentication failed...')

                    if (user._teamRole === 'admin' && user._teamId !== "") {
                        const checkChat = (chat) => {
                            return chat.chatId === chatId
                        }

                        if (!user._wpChats.find(checkChat)) return callback('Chat authentication failed...')

                        const { existingChat, chatGettingErr } = await getChat({ chatId })
                        if (chatGettingErr) return callback(chatGettingErr)

                        if (existingChat._chatParent !== id) return callback('Chat authentication failed...')
                        if (existingChat._chatHandlerId === memberId) return callback('Chat has been already assigned to the member...')

                        const { team, errr } = await getTeam({ teamId: user._teamId })
                        if (errr) return callback(errr)

                        if (team._teamAdmin !== id) return callback('Only team admins can assign a chat to member...')

                        const checkMembers = (member) => {
                            return member.id === memberId
                        }
                        if (!team._teamMembers.find(checkMembers)) return callback('Member not found in the team...')

                        const teamMember = await getUsers({ id: memberId })
                        if (teamMember.error) return callback(teamMember.error)

                        if (teamMember.user._teamRole !== 'seller' || teamMember.user._teamId !== user._teamId) return callback('Member authentication failed...')
                        if (teamMember.user._wpChats.find(checkChat)) return callback('Chat has been already assigned to the member...')

                        if (existingChat._chatHandlerId !== "") {
                            const prevTeamMember = await getUsers({ id: existingChat._chatHandlerId })
                            if (prevTeamMember.error) return callback(prevTeamMember.error)

                            var ownChats = prevTeamMember.user._wpChats
                            var chatId = JSON.stringify(existingChat._id)
                            for (let index = 0; index < ownChats.length; index++) {
                                const element = ownChats[index];
                                if (`"${element.chatId}"` === chatId) {
                                    ownChats.splice(index, 1)
                                    break;
                                }
                            }
                            const userUpdates = {
                                _wpChats: [...ownChats],
                            }
                            const { updatedUser, errrrr } = await updateUsers({ id: prevTeamMember.user._id, userUpdates })
                            if (errrrr) return callback(errrrr);

                            const userUpdates2 = {
                                _wpChats: [{
                                    chatName: existingChat._chatName,
                                    chatNumber: existingChat._chatNumber,
                                    chatId: existingChat._id,
                                    from: existingChat._chatMessages[existingChat._chatMessages.length - 1].from,
                                    lastMessage: `${existingChat._chatMessages[existingChat._chatMessages.length - 1].type === 'chat' ? existingChat._chatMessages[existingChat._chatMessages.length - 1].data : existingChat._chatMessages[existingChat._chatMessages.length - 1].type === 'image' ? 'Image' : existingChat._chatMessages[existingChat._chatMessages.length - 1].data}`,
                                    chatLabel: existingChat._chatLabel
                                }, ...teamMember.user._wpChats],
                            }
                            const updatedUser2 = await updateUsers({ id: teamMember.user._id, userUpdates: userUpdates2 })
                            if (updatedUser2.errrrr) return callback(updatedUser2.errrrr);

                            const chatUpdates = {
                                _chatHandlerId: updatedUser2.updatedUser._id,
                                _chatHandlerName: updatedUser2.updatedUser._name,
                                _chatParentTeam: team._id
                            }
                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId, chatUpdates })
                            if (chatUpdationErr) return callback(chatUpdationErr)

                            io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                            io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedUser2.updatedUser, target: updatedUser2.updatedUser._id })
                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                            return callback()
                        } else if (existingChat._chatHandlerId === "") {

                            const userUpdates2 = {
                                _wpChats: [{
                                    chatName: existingChat._chatName,
                                    chatNumber: existingChat._chatNumber,
                                    chatId: existingChat._id,
                                    from: existingChat._chatMessages[existingChat._chatMessages.length - 1].from,
                                    lastMessage: `${existingChat._chatMessages[existingChat._chatMessages.length - 1].type === 'chat' ? existingChat._chatMessages[existingChat._chatMessages.length - 1].data : existingChat._chatMessages[existingChat._chatMessages.length - 1].type === 'image' ? 'Image' : existingChat._chatMessages[existingChat._chatMessages.length - 1].data}`,
                                    chatLabel: existingChat._chatLabel
                                }, ...teamMember.user._wpChats]
                            }
                            const updatedUser2 = await updateUsers({ id: teamMember.user._id, userUpdates: userUpdates2 })
                            if (updatedUser2.errrrr) return callback(updatedUser2.errrrr);

                            const chatUpdates = {
                                _chatHandlerId: updatedUser2.updatedUser._id,
                                _chatHandlerName: updatedUser2.updatedUser._name,
                                _chatParentTeam: team._id
                            }
                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId, chatUpdates })
                            if (chatUpdationErr) return callback(chatUpdationErr)

                            io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedUser2.updatedUser, target: updatedUser2.updatedUser._id })
                            socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                            return callback()
                        }

                        const chatUpdates = {
                            _chatMessages: [...existingChat._chatMessages, {
                                type: 'note',
                                mimetype: 'note',
                                data: `The admin assigned the lead to ${teamMember.user._name}`,
                                caption: user._name,
                                from: "seller"
                            }]
                        }
                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                        if (chatUpdationErr) return callback(chatUpdationErr)

                        socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                    }
                }
            } catch (err) {
                console.log(err)
                return callback('Internal server error...')
            }
        })

        socket.on("integrate_whatsapp", async ({ authToken, password }, callback) => {
            try {
                console.log("Whatsapp integration request recieved...")
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    var client;

                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")
                    const sessionId = generateConnectionUrl(15)

                    if (user._teamId === "" && user._teamRole === 'neutral') {
                        console.log('Neutral user integrating whatsapp...')
                        if (user._wpIntegration || user._wpSessionData !== "") return callback('Whatsapp already integrated...')
                        else if (!user._wpIntegration && user._wpSessionData === "") {
                            client = new Client({
                                authStrategy: new LocalAuth({
                                    clientId: sessionId
                                })
                            });
                        } else {
                            return callback('User authentication failed...')
                        }
                    } else if (user._teamId !== "" && user._teamRole !== 'neutral') {
                        console.log('Team integrating whatsapp...')

                        if (user._teamRole === 'admin') {
                            console.log('Team admin integrating whatsapp...')

                            var { team, errr } = await getTeam({ teamId: user._teamId });
                            if (errr) return callback(errr);

                            if (team._teamWpIntegration || team._teamWpSessionData !== "") return callback('Whatsapp already integrated...')
                            else if (!team._teamWpIntegration && team._teamWpSessionData === "") {
                                client = new Client({
                                    authStrategy: new LocalAuth({
                                        clientId: sessionId
                                    })
                                });
                            } else {
                                return callback('Team authentication failed...')
                            }

                        } else if (user._teamRole === 'seller') {
                            return callback('Only admins can integrate whatsapp...')
                        } else {
                            return callback('User authentication failed...')
                        }

                    } else {
                        return callback('User authentication failed...')
                    }

                    client.on('qr', async (qr) => {
                        console.log('User Received qr code...')
                        socket.emit('qr_recieved', { password: process.env.CLIENT_SOCKET_PASSWORD, qr })
                    });

                    client.on('ready', async () => {
                        console.log("Whatspp Client ready...")
                        const { user, error } = await getUsers({ id });
                        if (error) return callback(error);

                        if (user._teamId === "" && user._teamRole === 'neutral') {
                            console.log('Neutral user integrating whatsapp...')
                            if (user._wpIntegration || user._wpSessionData !== "") return callback('Whatsapp already integrated...')
                            else if (!user._wpIntegration && user._wpSessionData === "") {
                                client_wp_sessions.push({
                                    sessionId,
                                    client
                                })

                                const userUpdates = {
                                    _wpIntegration: true,
                                    _wpSessionData: sessionId
                                }
                                const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                if (errrrr) return callback(errrrr);



                                clientCopy = client
                                socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                socket.emit("whatsapp_integrated", { password: process.env.CLIENT_SOCKET_PASSWORD })
                            } else {
                                return callback('User authentication failed...')
                            }
                        } else if (user._teamId !== "" && user._teamRole !== 'neutral') {
                            console.log('Team integrating whatsapp...')

                            if (user._teamRole === 'admin') {
                                console.log('Team admin integrating whatsapp...')

                                var { team, errr } = await getTeam({ teamId: user._teamId });
                                if (errr) return callback(errr);

                                if (team._teamWpIntegration || team._teamWpSessionData !== "") return callback('Whatsapp already integrated...')
                                else if (!team._teamWpIntegration && team._teamWpSessionData === "") {
                                    const userUpdates = {
                                        _wpIntegration: true,
                                        _wpSessionData: sessionId
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);

                                    const teamUpdates = {
                                        _teamWpIntegration: true,
                                        _teamWpSessionData: sessionId,
                                    }
                                    const { updatedTeam, errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })
                                    if (errrr) return callback(errrr)

                                    client_wp_sessions.push({
                                        sessionId,
                                        client
                                    })

                                    clientCopy = client
                                    io.to(user._teamId).emit("team_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedTeam, pass: user._teamId })
                                    io.to(user._teamId).emit("whatsapp_integrated", { password: process.env.CLIENT_SOCKET_PASSWORD, pass: user._teamId })
                                    socket.emit("whatsapp_integrated", { password: process.env.CLIENT_SOCKET_PASSWORD })
                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                } else {
                                    return callback('Team authentication failed...')
                                }

                            } else if (user._teamRole === 'seller') {
                                return callback('Only admins can integrate whatsapp...')
                            } else {
                                return callback('User authentication failed...')
                            }

                        } else {
                            return callback('User authentication failed...')
                        }
                    });

                    client.on("message", async (message) => {
                        var { user, error } = await getUsers({ id });
                        if (error) return callback(error);

                        if (user._teamRole !== "seller") {
                            if (message._data.id.participant) {
                                console.log('User Got A Message Ignored due to group chat...')
                            }
                            else if (message.type === 'document') {
                                console.log('User Got A Message ignored due to document....')
                            }
                            else if (message._data.type === 'chat') {
                                console.log("User Got A Text Message processing in authentcation...");
                                var chatId;
                                var returnedUser;
                                var isChatAlreadyUpdated = false

                                var { user, error } = await getUsers({ id });
                                if (error) return callback(error);

                                if (user._wpIntegration && user._wpSessionData !== "") {
                                    const clientNumber = message._data.author === undefined ? message._data.from : message._data.author;
                                    const checkChat = (chat) => {
                                        return chat.chatNumber === clientNumber
                                    }
                                    var userTeam

                                    const { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    if (user._teamId !== "" && user._teamRole !== 'neutral') {
                                        var { team, errr } = await getTeam({ teamId: user._teamId });
                                        if (errr) return callback(errr);

                                        if (!team._teamWpIntegration && team._teamWpSessionData === "") return callback('Whatsapp not integrated')
                                        userTeam = team
                                    }

                                    if (user._wpChats.find(checkChat)) {
                                        console.log("Updating the text message Chat found in the user / Authentication...")
                                        const getChatDetails = (chat) => {
                                            if (chat.chatNumber === clientNumber) {
                                                return chat;
                                            }
                                        }
                                        chatId = user._wpChats.find(getChatDetails).chatId

                                        const { existingChat, chatGettingErr } = await getChat({ chatId })
                                        if (chatGettingErr) return callback(chatGettingErr)

                                        if (existingChat._chatParent !== id) return callback('Chat authentication failed...')

                                        const chatUpdates = {
                                            _chatMessages: [...existingChat._chatMessages, {
                                                type: message._data.type,
                                                mimetype: message._data.mimetype,
                                                data: message._data.body,
                                                caption: message._data.caption
                                            }]
                                        }
                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                        socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                        var chatDetails;
                                        var ownChats = user._wpChats
                                        for (let index = 0; index < ownChats.length; index++) {
                                            const element = user._wpChats[index];
                                            if (element.chatId === chatId) {
                                                chatDetails = ownChats.splice(index, 1)
                                                break;
                                            }
                                        }

                                        const orgChat = {
                                            chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: message._data.body,
                                            from: 'client',
                                            chatLabel: updatedChat._chatLabel
                                        }
                                        const userUpdates = {
                                            _wpChats: [orgChat, ...ownChats]
                                        }
                                        const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                        if (errrrr) return callback(errrrr);

                                        socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })

                                        if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                            const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                            if (chatHandler.error) return callback(chatHandler.error)

                                            var chatDetails;
                                            var ownChats = chatHandler.user._wpChats
                                            for (let index = 0; index < ownChats.length; index++) {
                                                const element = chatHandler.user._wpChats[index];
                                                if (element.chatId === chatId) {
                                                    chatDetails = ownChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const orgChat = {
                                                chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                                chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                                chatId: chatDetails[0].chatId,
                                                lastMessage: message._data.body,
                                                from: 'client',
                                                chatLabel: updatedChat._chatLabel
                                            }
                                            const userUpdates = {
                                                _wpChats: [orgChat, ...ownChats]
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                            if (errrrr) return callback(errrrr);

                                            console.log('Emmited to member')
                                            io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                            io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                        }

                                        isChatAlreadyUpdated = true
                                    } else if (!user._wpChats.find(checkChat)) {
                                        console.log("Adding New Chat not found in user  / Authentication....")
                                        const { newChat, chatCreateErr } = await addChat({
                                            chatName: message._data.notifyName,
                                            chatNumber: message._data.author === undefined ? message._data.from : message._data.author,
                                            chatParent: id,
                                            chat: {
                                                type: message._data.type,
                                                mimetype: message._data.mimetype,
                                                data: message._data.body,
                                                caption: message._data.caption
                                            }
                                        })
                                        if (chatCreateErr) return callback(chatCreateErr)
                                        chatId = newChat._id

                                        const { user, error } = await getUsers({ id });
                                        if (error) return callback(error);

                                        var prevChats = newChat._chatMessages
                                        if (user._chatBot) {
                                            for (let index = 0; index < user._chatBotTemplate.length; index++) {
                                                const template = user._chatBotTemplate[index];
                                                if (template.type === 'chat') {
                                                    message.reply(template.data)

                                                    const chatUpdates = {
                                                        _chatMessages: [...prevChats, {
                                                            type: 'chat',
                                                            mimetype: 'chat',
                                                            data: template.data,
                                                            caption: 'SalesBot',
                                                            from: "seller"
                                                        }]
                                                    }
                                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                                    prevChats = updatedChat._chatMessages
                                                } else if (template.type === 'image') {
                                                    const media = new MessageMedia(template.mimetype, template.data.substring(template.data.indexOf(',') + 1))
                                                    clientCopy.sendMessage(newChat._chatNumber, media)


                                                    const chatUpdates = {
                                                        _chatMessages: [...prevChats, {
                                                            type: 'image',
                                                            mimetype: template.mimetype,
                                                            data: template.data.substring(template.data.indexOf(',') + 1),
                                                            caption: 'SalesBot',
                                                            from: "seller"
                                                        }]
                                                    }
                                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                                    prevChats = updatedChat._chatMessages
                                                }
                                            }
                                        }

                                        const date = new Date();
                                        const day = date.getDay()
                                        const totalLeadsGainedThisWeek = JSON.parse(user._totalLeadsGainedThisWeek)
                                        var leadsUpdate;

                                        switch (day) {
                                            case 0:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads + 1
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 1:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads + 1
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 2:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads + 1
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 3:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads + 1
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 4:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads + 1
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 5:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads + 1
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 6:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads + 1
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                        }

                                        if (user._chatBot) {
                                            const userUpdates = {
                                                _wpChats: [{
                                                    chatName: newChat._chatName,
                                                    chatId: newChat._id,
                                                    chatNumber: newChat._chatNumber,
                                                    lastMessage: user._chatBotTemplate[user._chatBotTemplate.length - 1].type === 'chat' ? user._chatBotTemplate[user._chatBotTemplate.length - 1].data : "Image",
                                                    from: 'seller',
                                                    chatLabel: newChat._chatLabel
                                                }, ...user._wpChats],
                                                _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                            if (errrrr) return callback(errrrr);
                                        } else {
                                            const userUpdates = {
                                                _wpChats: [{
                                                    chatName: newChat._chatName,
                                                    chatId: newChat._id,
                                                    chatNumber: newChat._chatNumber,
                                                    lastMessage: message._data.body,
                                                    from: 'client',
                                                    chatLabel: newChat._chatLabel
                                                }, ...user._wpChats],
                                                _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                            if (errrrr) return callback(errrrr);
                                        }

                                        for (let index = 0; index > -1; index++) {
                                            const teamMembers = userTeam._teamMembers;
                                            const memberIndex = Math.floor(Math.random() * ((teamMembers.length - 1) - 1 + 1) + 1)

                                            const memberId = teamMembers[memberIndex].id
                                            const memberRole = teamMembers[memberIndex].role
                                            if (memberRole !== 'admin') {
                                                const teamMember = await getUsers({ id: memberId })
                                                if (teamMember.error) return callback(teamMember.error)

                                                if (teamMember.user._teamRole !== 'seller' || teamMember.user._teamId !== user._teamId) return callback('Member authentication failed...')
                                                if (teamMember.user._wpChats.find(checkChat)) return callback('Chat has been already assigned to the member...')

                                                if (newChat._chatHandlerId === "") {

                                                    const userUpdates2 = {
                                                        _wpChats: [{
                                                            chatName: newChat._chatName,
                                                            chatNumber: newChat._chatNumber,
                                                            chatId: newChat._id,
                                                            from: newChat._chatMessages[newChat._chatMessages.length - 1].from,
                                                            lastMessage: `${newChat._chatMessages[newChat._chatMessages.length - 1].type === 'chat' ? newChat._chatMessages[newChat._chatMessages.length - 1].data : newChat._chatMessages[newChat._chatMessages.length - 1].type === 'image' ? 'Image' : newChat._chatMessages[newChat._chatMessages.length - 1].data}`,
                                                            chatLabel: newChat._chatLabel
                                                        }, ...teamMember.user._wpChats]
                                                    }
                                                    const updatedUser2 = await updateUsers({ id: teamMember.user._id, userUpdates: userUpdates2 })
                                                    if (updatedUser2.errrrr) return callback(updatedUser2.errrrr);

                                                    const chatUpdates = {
                                                        _chatHandlerId: updatedUser2.updatedUser._id,
                                                        _chatHandlerName: updatedUser2.updatedUser._name,
                                                        _chatParentTeam: team._id
                                                    }
                                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                                    io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedUser2.updatedUser, target: updatedUser2.updatedUser._id })
                                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                                    return callback()
                                                }

                                                break;
                                            } else {
                                                continue
                                            }
                                        }
                                    }

                                    var { existingChat, chatGettingErr } = await getChat({ chatId })
                                    if (chatGettingErr) return callback(chatGettingErr)

                                    var returnedUser = await getUsers({ id });
                                    if (returnedUser.error) return callback(error);

                                    if (returnedUser.user._wpChats.find(checkChat)) {
                                        if (existingChat._chatParent !== id && existingChat._chatParentTeam !== user._teamId && existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')
                                    } else if (returnedUser.user._wpChats.find(checkChat)) {
                                        if (existingChat._chatParent !== id) return callback('Chat authentication failed...')
                                    }

                                    const userDirectories = user._directories
                                    for (let index = 0; index < userDirectories.length; index++) {
                                        const element = userDirectories[index];


                                        const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                        if (directoryGettingErr) return callback(directoryGettingErr)
                                        if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                        if (existingdirectory._allIntegration) {

                                            var directoryChats = existingdirectory._directoryChats
                                            for (let index = 0; index < directoryChats.length; index++) {
                                                const element = directoryChats[index].data;
                                                if (`${element[4].field}@c.us` === existingChat._chatNumber) {
                                                    directoryChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const directoryUpdates = {
                                                _directoryChats: [...directoryChats, {
                                                    data: [{
                                                        field: existingChat._chatDate
                                                    }, {
                                                        field: existingChat._chatPlatform
                                                    }, {
                                                        field: existingChat._chatName
                                                    }, {
                                                        field: existingChat._chatEmail
                                                    }, {
                                                        field: existingChat._chatNumber.substring(0, existingChat._chatNumber.indexOf('@'))
                                                    }, {
                                                        field: existingChat._chatCampaign
                                                    }, {
                                                        field: existingChat._chatBusiness
                                                    }, {
                                                        field: existingChat._chatObjective
                                                    },]
                                                }],
                                            }
                                            const { updatedDirectory } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })

                                            const { updatedChat } = await updateChat({
                                                chatId: existingChat._id, chatUpdates: {
                                                    _chatDirectory: updatedDirectory._directoryName
                                                }
                                            })

                                            existingChat = updatedChat
                                        }
                                    }

                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: returnedUser.user })
                                    socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: existingChat })
                                } else {
                                    return callback('Whatsapp not authenticated...')
                                }
                            }
                            else if (message.hasMedia) {
                                if (message._data.type === 'image') {
                                    console.log("Message with media processing in authentcation...");
                                    var chatId;
                                    var returnedUser;
                                    var isChatAlreadyUpdated = false

                                    var { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    if (user._wpIntegration && user._wpSessionData !== "") {
                                        const clientNumber = message._data.author === undefined ? message._data.from : message._data.author;
                                        const checkChat = (chat) => {
                                            return chat.chatNumber === clientNumber
                                        }
                                        var userTeam

                                        const { user, error } = await getUsers({ id });
                                        if (error) return callback(error);

                                        if (user._teamId !== "" && user._teamRole !== 'neutral') {
                                            var { team, errr } = await getTeam({ teamId: user._teamId });
                                            if (errr) return callback(errr);

                                            if (!team._teamWpIntegration && team._teamWpSessionData === "") return callback('Whatsapp not integrated...')
                                            userTeam = team
                                        }

                                        if (user._wpChats.find(checkChat)) {
                                            const getChatDetails = (chat) => {
                                                if (chat.chatNumber === clientNumber) {
                                                    return chat;
                                                }
                                            }
                                            chatId = user._wpChats.find(getChatDetails).chatId

                                            const { existingChat, chatGettingErr } = await getChat({ chatId })
                                            if (chatGettingErr) return callback(chatGettingErr)

                                            if (existingChat._chatParent !== id) return callback('Chat authentication failed...')


                                            const chatUpdates = {
                                                _chatMessages: [...existingChat._chatMessages, {
                                                    type: message._data.type,
                                                    mimetype: message._data.mimetype,
                                                    data: message._data.body,
                                                    caption: message._data.caption
                                                }]
                                            }
                                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                            if (chatUpdationErr) return callback(chatUpdationErr)

                                            socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                            var chatDetails;
                                            var ownChats = user._wpChats
                                            for (let index = 0; index < ownChats.length; index++) {
                                                const element = user._wpChats[index];
                                                if (element.chatId === chatId) {
                                                    chatDetails = ownChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const orgChat = {
                                                chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                                chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                                chatId: chatDetails[0].chatId,
                                                lastMessage: 'Image',
                                                from: 'client',
                                                chatLabel: updatedChat._chatLabel
                                            }
                                            const userUpdates = {
                                                _wpChats: [orgChat, ...ownChats]
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                            if (errrrr) return callback(errrrr);

                                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })

                                            if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                                const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                                if (chatHandler.error) return callback(chatHandler.error)

                                                var chatDetails;
                                                var ownChats = chatHandler.user._wpChats
                                                for (let index = 0; index < ownChats.length; index++) {
                                                    const element = chatHandler.user._wpChats[index];
                                                    if (element.chatId === chatId) {
                                                        chatDetails = ownChats.splice(index, 1)
                                                        break;
                                                    }
                                                }

                                                const orgChat = {
                                                    chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                                    chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                                    chatId: chatDetails[0].chatId,
                                                    lastMessage: 'Image',
                                                    from: 'client',
                                                    chatLabel: updatedChat._chatLabel
                                                }
                                                const userUpdates = {
                                                    _wpChats: [orgChat, ...ownChats]
                                                }
                                                const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                                if (errrrr) return callback(errrrr);

                                                io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                                io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                            }

                                            isChatAlreadyUpdated = true
                                        } else if (!user._wpChats.find(checkChat)) {
                                            console.log("Adding Chat....")
                                            const { newChat, chatCreateErr } = await addChat({
                                                chatName: message._data.notifyName,
                                                chatNumber: message._data.author === undefined ? message._data.from : message._data.author,
                                                chatParent: id,
                                                chat: {
                                                    type: message._data.type,
                                                    mimetype: message._data.mimetype,
                                                    data: message._data.body,
                                                    caption: message._data.caption
                                                }
                                            })
                                            if (chatCreateErr) return callback(chatCreateErr)
                                            chatId = newChat._id

                                            const { user, error } = await getUsers({ id });
                                            if (error) return callback(error);

                                            const userDirectories = user._directories
                                            for (let index = 0; index < userDirectories.length; index++) {
                                                const element = userDirectories[index];


                                                const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                                if (directoryGettingErr) return callback(directoryGettingErr)
                                                if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                                if (existingdirectory._allIntegration) {

                                                    var directoryChats = existingdirectory._directoryChats
                                                    for (let index = 0; index < directoryChats.length; index++) {
                                                        const element = directoryChats[index].data;
                                                        if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                            directoryChats.splice(index, 1)
                                                            break;
                                                        }
                                                    }

                                                    const directoryUpdates = {
                                                        _directoryChats: [...directoryChats, {
                                                            data: [{
                                                                field: newChat._chatDate
                                                            }, {
                                                                field: newChat._chatPlatform
                                                            }, {
                                                                field: newChat._chatName
                                                            }, {
                                                                field: newChat._chatEmail
                                                            }, {
                                                                field: newChat._chatNumber.substring(0, newChat._chatNumber.indexOf('@'))
                                                            }, {
                                                                field: newChat._chatCampaign
                                                            }, {
                                                                field: newChat._chatBusiness
                                                            }, {
                                                                field: newChat._chatObjective
                                                            },]
                                                        }],
                                                    }
                                                    const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                                    if (directoryUpdationErr) return callback(directoryUpdationErr);
                                                    console.log(directoryUpdates)
                                                }
                                            }

                                            var prevChats = newChat._chatMessages
                                            if (user._chatBot) {
                                                for (let index = 0; index < user._chatBotTemplate.length; index++) {
                                                    const template = user._chatBotTemplate[index];
                                                    if (template.type === 'chat') {
                                                        message.reply(template.data)

                                                        const chatUpdates = {
                                                            _chatMessages: [...prevChats, {
                                                                type: 'chat',
                                                                mimetype: 'chat',
                                                                data: template.data,
                                                                caption: 'SalesBot',
                                                                from: "seller"
                                                            }]
                                                        }
                                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                                        prevChats = updatedChat._chatMessages
                                                    } else if (template.type === 'image') {
                                                        const media = new MessageMedia(template.mimetype, template.data.substring(template.data.indexOf(',') + 1))
                                                        clientCopy.sendMessage(newChat._chatNumber, media)


                                                        const chatUpdates = {
                                                            _chatMessages: [...prevChats, {
                                                                type: 'image',
                                                                mimetype: template.mimetype,
                                                                data: template.data.substring(template.data.indexOf(',') + 1),
                                                                caption: 'SalesBot',
                                                                from: "seller"
                                                            }]
                                                        }
                                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                                        prevChats = updatedChat._chatMessages
                                                    }
                                                }
                                            }

                                            const date = new Date();
                                            const day = date.getDay()
                                            const totalLeadsGainedThisWeek = JSON.parse(user._totalLeadsGainedThisWeek)
                                            var leadsUpdate;

                                            switch (day) {
                                                case 0:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads + 1
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 1:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads + 1
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 2:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads + 1
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 3:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads + 1
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 4:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads + 1
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 5:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads + 1
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 6:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads + 1
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                            }

                                            if (user._chatBot) {
                                                const userUpdates = {
                                                    _wpChats: [{
                                                        chatName: newChat._chatName,
                                                        chatId: newChat._id,
                                                        chatNumber: newChat._chatNumber,
                                                        lastMessage: user._chatBotTemplate[user._chatBotTemplate.length - 1].type === 'chat' ? user._chatBotTemplate[user._chatBotTemplate.length - 1].data : "Image",
                                                        from: 'seller',
                                                        chatLabel: newChat._chatLabel
                                                    }, ...user._wpChats],
                                                    _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                                }
                                                const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                                if (errrrr) return callback(errrrr);
                                            } else {
                                                const userUpdates = {
                                                    _wpChats: [{
                                                        chatName: newChat._chatName,
                                                        chatId: newChat._id,
                                                        chatNumber: newChat._chatNumber,
                                                        lastMessage: 'Image',
                                                        from: 'client',
                                                        chatLabel: newChat._chatLabel
                                                    }, ...user._wpChats],
                                                    _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                                }
                                                const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                                if (errrrr) return callback(errrrr);
                                            }

                                            for (let index = 0; index > -1; index++) {
                                                const teamMembers = userTeam._teamMembers;
                                                const memberIndex = Math.floor(Math.random() * ((teamMembers.length - 1) - 1 + 1) + 1)

                                                const memberId = teamMembers[memberIndex].id
                                                const memberRole = teamMembers[memberIndex].role
                                                if (memberRole !== 'admin') {
                                                    const teamMember = await getUsers({ id: memberId })
                                                    if (teamMember.error) return callback(teamMember.error)

                                                    if (teamMember.user._teamRole !== 'seller' || teamMember.user._teamId !== user._teamId) return callback('Member authentication failed...')
                                                    if (teamMember.user._wpChats.find(checkChat)) return callback('Chat has been already assigned to the member...')

                                                    if (newChat._chatHandlerId === "") {

                                                        const userUpdates2 = {
                                                            _wpChats: [{
                                                                chatName: newChat._chatName,
                                                                chatNumber: newChat._chatNumber,
                                                                chatId: newChat._id,
                                                                from: newChat._chatMessages[newChat._chatMessages.length - 1].from,
                                                                lastMessage: `${newChat._chatMessages[newChat._chatMessages.length - 1].type === 'chat' ? newChat._chatMessages[newChat._chatMessages.length - 1].data : newChat._chatMessages[newChat._chatMessages.length - 1].type === 'image' ? 'Image' : newChat._chatMessages[newChat._chatMessages.length - 1].data}`,
                                                                chatLabel: newChat._chatLabel
                                                            }, ...teamMember.user._wpChats]
                                                        }
                                                        const updatedUser2 = await updateUsers({ id: teamMember.user._id, userUpdates: userUpdates2 })
                                                        if (updatedUser2.errrrr) return callback(updatedUser2.errrrr);

                                                        const chatUpdates = {
                                                            _chatHandlerId: updatedUser2.updatedUser._id,
                                                            _chatHandlerName: updatedUser2.updatedUser._name,
                                                            _chatParentTeam: team._id
                                                        }
                                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedUser2.updatedUser, target: updatedUser2.updatedUser._id })
                                                        socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                                        return callback()
                                                    }

                                                    break;
                                                } else {
                                                    continue
                                                }
                                            }
                                        }

                                        // if (user._wpChats.find(checkChat)) {
                                        //     console.log("Updating the assigned chats from start...")
                                        //     const getChatDetails = (chat) => {
                                        //         if (chat.chatNumber === clientNumber) {
                                        //             return chat;
                                        //         }
                                        //     }
                                        //     chatId = user._wpChats.find(getChatDetails).chatId

                                        //     const { existingChat, chatGettingErr } = await getChat({ chatId })
                                        //     if (chatGettingErr) return callback(chatGettingErr)

                                        //     if (existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')
                                        //     if (existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')
                                        //     var globalChat = existingChat

                                        //     const chatUpdates = {
                                        //         _chatMessages: [...existingChat._chatMessages, {
                                        //             type: message._data.type,
                                        //             mimetype: message._data.mimetype,
                                        //             data: message._data.body,
                                        //             caption: message._data.caption
                                        //         }]
                                        //     }
                                        //     const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                        //     if (chatUpdationErr) return callback(chatUpdationErr)

                                        //     globalChat = updatedChat

                                        //     socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })


                                        //     var chatDetails;
                                        //     var ownChats = user._wpChats
                                        //     for (let index = 0; index < ownChats.length; index++) {
                                        //         const element = user._wpChats[index];
                                        //         if (element.chatId === chatId) {
                                        //             chatDetails = ownChats.splice(index, 1)
                                        //             break;
                                        //         }
                                        //     }

                                        //     const orgChat = {
                                        //         chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                        //         chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                        //         chatId: chatDetails[0].chatId,
                                        //         lastMessage: 'Image',
                                        //         from: 'client',
                                        //         chatLabel: existingChat._chatLabel
                                        //     }
                                        //     const userUpdates = {
                                        //         _wpChats: [orgChat, ...ownChats]
                                        //     }
                                        //     const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                        //     if (errrrr) return callback(errrrr);

                                        //     socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })

                                        //     const teamAdmin = await getUsers({ id: userTeam._teamAdmin })
                                        //     if (teamAdmin.error) return callback(teamAdmin.error)

                                        //     var chatDetails2;
                                        //     var ownChats2 = teamAdmin.user._wpChats
                                        //     for (let index = 0; index < ownChats2.length; index++) {
                                        //         const element = teamAdmin.user._wpChats[index];
                                        //         if (element.chatId === chatId) {
                                        //             chatDetails2 = ownChats2.splice(index, 1)
                                        //             break;
                                        //         }
                                        //     }

                                        //     const orgChat2 = {
                                        //         chatName: chatDetails2[0].chatName === "" ? "Unknown Contact" : chatDetails2[0].chatName,
                                        //         chatNumber: chatDetails2[0].chatNumber === "" ? "Unknown Number" : chatDetails2[0].chatNumber,
                                        //         chatId: chatDetails2[0].chatId,
                                        //         lastMessage: 'Image',
                                        //         from: 'client',
                                        //         chatLabel: existingChat._chatLabel
                                        //     }
                                        //     const userUpdates2 = {
                                        //         _wpChats: [orgChat2, ...ownChats2]
                                        //     }
                                        //     const updatedTeamAdmin = await updateUsers({ id: teamAdmin.user._id, userUpdates: userUpdates2 })
                                        //     if (updatedTeamAdmin.errrrr) return callback(updatedTeamAdmin.errrrr);

                                        //     io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedTeamAdmin.updatedUser, target: updatedTeamAdmin.updatedUser._id })
                                        //     io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: globalChat, target: updatedTeamAdmin.updatedUser._id })
                                        // }

                                        var { existingChat, chatGettingErr } = await getChat({ chatId })
                                        if (chatGettingErr) return callback(chatGettingErr)

                                        if (existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')

                                        var returnedUser = await getUsers({ id });
                                        if (returnedUser.error) return callback(error);

                                        const userDirectories = user._directories
                                        for (let index = 0; index < userDirectories.length; index++) {
                                            const element = userDirectories[index];


                                            const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                            if (directoryGettingErr) return callback(directoryGettingErr)
                                            if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                            if (existingdirectory._allIntegration) {

                                                var directoryChats = existingdirectory._directoryChats
                                                for (let index = 0; index < directoryChats.length; index++) {
                                                    const element = directoryChats[index].data;
                                                    if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                        directoryChats.splice(index, 1)
                                                        break;
                                                    }
                                                }

                                                const directoryUpdates = {
                                                    _directoryChats: [...directoryChats, {
                                                        data: [{
                                                            field: existingChat._chatDate
                                                        }, {
                                                            field: existingChat._chatPlatform
                                                        }, {
                                                            field: existingChat._chatName
                                                        }, {
                                                            field: existingChat._chatEmail
                                                        }, {
                                                            field: existingChat._chatNumber.substring(0, existingChat._chatNumber.indexOf('@'))
                                                        }, {
                                                            field: existingChat._chatCampaign
                                                        }, {
                                                            field: existingChat._chatBusiness
                                                        }, {
                                                            field: existingChat._chatObjective
                                                        },]
                                                    }],
                                                }
                                                const { updatedDirectory } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })

                                                const { updatedChat } = await updateChat({
                                                    chatId: existingChat._id, chatUpdates: {
                                                        _chatDirectory: updatedDirectory._directoryName
                                                    }
                                                })

                                                existingChat = updatedChat
                                            }
                                        }


                                        socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: returnedUser.user })
                                        socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: existingChat })
                                    }
                                } else {
                                    console.log('Message ignored due to some unsupported media...')
                                }
                            }
                        }
                    })

                    client.initialize();
                }
            } catch (err) {
                console.log(err);
                return callback('Internal server error...')
            }
        })

        socket.on("authenticate_whatsapp", async ({ authToken, password }, callback) => {
            try {
                console.log("Authenticate")
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    var client;
                    var sessionId
                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    var { user, error } = await getUsers({ id });
                    if (error) return callback(error);

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (user._teamId === "" && user._teamRole === 'neutral') {
                        console.log('Neutral user authenticating whatsapp...')
                        if (!user._wpIntegration || user._wpSessionData === "") return callback('Please integrate whatsapp first...')
                        else if (user._wpIntegration && user._wpSessionData !== "") {
                            sessionId = user._wpSessionData
                        } else {
                            return callback('User authentication failed...')
                        }
                    } else if (user._teamId !== "" && user._teamRole !== 'neutral') {
                        console.log('Team integrating whatsapp...')

                        if (user._teamRole !== 'neutral') {
                            console.log('Team admin integrating whatsapp...')

                            var { team, errr } = await getTeam({ teamId: user._teamId });
                            if (errr) return callback(errr);

                            if (!team._teamWpIntegration || team._teamWpSessionData === "") return callback('Whatsapp already integrated...')
                            else if (team._teamWpIntegration && team._teamWpSessionData !== "") {
                                sessionId = team._teamWpSessionData
                            } else {
                                return callback('Team authentication failed...')
                            }

                        } else {
                            return callback('User authentication failed...')
                        }

                    } else {
                        return callback('User authentication failed...')
                    }

                    const checkActiveSession = (session) => {
                        return session.sessionId === sessionId
                    }

                    if (user._teamId === "" && user._teamRole === 'neutral') {
                        if (user._wpIntegration && user._wpSessionData !== "") {
                            if (client_wp_sessions.find(checkActiveSession)) {
                                const getActiveSession = (session) => {
                                    if (session.sessionId === sessionId) {
                                        return session
                                    }
                                }

                                const clientActiveSession = client_wp_sessions.find(getActiveSession)
                                client = clientActiveSession.client
                                clientCopy = client
                                console.log("Client ready...")
                                socket.emit("whatsapp_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD })
                            } else {
                                client = new Client({
                                    authStrategy: new LocalAuth({
                                        clientId: sessionId
                                    })
                                });
                            }
                        } else {
                            return callback('Please integrate whatsapp first...')
                        }
                    } else if (user._teamId !== "" && user._teamRole !== 'neutral') {
                        console.log('Team authenticating whatsapp...')

                        var { team, errr } = await getTeam({ teamId: user._teamId });
                        if (errr) return callback(errr);

                        if (!team._teamWpIntegration || team._teamWpSessionData === "") return callback('Please integrate whatsapp first...')
                        else if (team._teamWpIntegration && team._teamWpSessionData !== "") {
                            if (client_wp_sessions.find(checkActiveSession)) {
                                const getActiveSession = (session) => {
                                    if (session.sessionId === sessionId) {
                                        return session
                                    }
                                }

                                const clientActiveSession = client_wp_sessions.find(getActiveSession)
                                client = clientActiveSession.client
                                clientCopy = client
                                console.log("Client ready...")
                                socket.emit("whatsapp_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD })
                                io.to(user._teamId).emit("whatsapp_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD })
                            } else {
                                client = new Client({
                                    authStrategy: new LocalAuth({
                                        clientId: sessionId
                                    })
                                });
                            }
                        } else {
                            return callback('Team authentication failed...')
                        }
                    }

                    client.on('ready', async () => {
                        console.log("Client ready...")
                        const { user, error } = await getUsers({ id });
                        if (error) return callback(error);

                        if (user._teamId === "" && user._teamRole === 'neutral') {
                            if (user._wpIntegration && user._wpSessionData !== "") {
                                clientCopy = client
                                client_wp_sessions.push({
                                    sessionId,
                                    client
                                })

                                socket.emit("whatsapp_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD })
                            } else {
                                return callback('Please integrate whatsapp first...')
                            }
                        } else if (user._teamId !== "" && user._teamRole !== 'neutral') {
                            var { team, errr } = await getTeam({ teamId: user._teamId });
                            if (errr) return callback(errr);

                            if (!team._teamWpIntegration || team._teamWpSessionData === "") return callback('Please integrate whatsapp first...')
                            else if (team._teamWpIntegration && team._teamWpSessionData !== "") {
                                client_wp_sessions.push({
                                    sessionId,
                                    client
                                })

                                const checkActiveSession = (browser) => {
                                    return browser.sessionId === user._wpSessionData
                                }

                                const getActiveSession = (browser) => {
                                    if (browser.sessionId === user._wpSessionData) {
                                        return browser
                                    }
                                }

                                if (user._teamRole === 'seller') {
                                    if (browser_wp_sessions.find(checkActiveSession)) {
                                        console.log("Closing the previous active session seller")

                                        const pageToBeClosed = browser_wp_sessions.find(getActiveSession)
                                        await pageToBeClosed.page.close()

                                        for (let index = 0; index < browser_wp_sessions.length; index++) {
                                            const element = browser_wp_sessions[index];
                                            if (element.sessionId === user._wpSessionData) {
                                                browser_wp_sessions.splice(index, 1)
                                                break;
                                            }
                                        }

                                        const teamAdmin = await getUsers({ id: team._teamAdmin });
                                        if (teamAdmin.error) return callback(teamAdmin.error);

                                        const browser = await puppeteer.launch({
                                            headless: false
                                        });
                                        const page = await browser.newPage();
                                        await page.goto(`http://localhost:1337/home?authToken=${team._teamAdminAuthToken}`);

                                        const userUpdates = {
                                            _wpInstanceActive: true
                                        }
                                        const { errrrr } = await updateUsers({ id: teamAdmin.user._id, userUpdates })

                                        const teamUpdates = {
                                            _teamWpInstanceActive: true
                                        }
                                        const { errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })

                                        if (!errrrr && !errrr) {
                                            browser_wp_sessions.push({
                                                sessionId: user._wpSessionData,
                                                page
                                            })
                                        }
                                    } else {
                                        const teamAdmin = await getUsers({ id: team._teamAdmin });
                                        if (teamAdmin.error) return callback(teamAdmin.error);

                                        const browser = await puppeteer.launch({
                                            headless: false
                                        });
                                        const page = await browser.newPage();
                                        await page.goto(`http://localhost:1337/home?authToken=${team._teamAdminAuthToken}`);


                                        const userUpdates = {
                                            _wpInstanceActive: true
                                        }
                                        const { errrrr } = await updateUsers({ id: teamAdmin.user._id, userUpdates })

                                        const teamUpdates = {
                                            _teamWpInstanceActive: true
                                        }
                                        const { errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })

                                        if (!errrrr && !errrr) {
                                            browser_wp_sessions.push({
                                                sessionId: user._wpSessionData,
                                                page
                                            })
                                        }
                                    }
                                }

                                clientCopy = client
                                io.to(user._teamId).emit("whatsapp_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD, pass: user._teamId })
                                socket.emit("whatsapp_authenticated", { password: process.env.CLIENT_SOCKET_PASSWORD })
                            }
                        } else {
                            return callback('User authentication failed...')
                        }
                    });

                    client.on("message", async (message) => {
                        var { user, error } = await getUsers({ id });
                        if (error) return callback(error);

                        if (user._teamRole !== "seller") {
                            if (message._data.id.participant) {
                                console.log('User Got A Message Ignored due to group chat...')
                            }
                            else if (message.type === 'document') {
                                console.log('User Got A Message ignored due to document....')
                            }
                            else if (message._data.type === 'chat') {
                                console.log("User Got A Text Message processing in authentcation...");
                                var chatId;
                                var returnedUser;
                                var isChatAlreadyUpdated = false

                                var { user, error } = await getUsers({ id });
                                if (error) return callback(error);

                                if (user._wpIntegration && user._wpSessionData !== "") {
                                    const clientNumber = message._data.author === undefined ? message._data.from : message._data.author;
                                    const checkChat = (chat) => {
                                        return chat.chatNumber === clientNumber
                                    }
                                    var userTeam

                                    const { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    if (user._teamId !== "" && user._teamRole !== 'neutral') {
                                        var { team, errr } = await getTeam({ teamId: user._teamId });
                                        if (errr) return callback(errr);

                                        if (!team._teamWpIntegration && team._teamWpSessionData === "") return callback('Whatsapp not integrated')
                                        userTeam = team
                                    }

                                    if (user._wpChats.find(checkChat)) {
                                        console.log("Updating the text message Chat found in the user / Authentication...")
                                        const getChatDetails = (chat) => {
                                            if (chat.chatNumber === clientNumber) {
                                                return chat;
                                            }
                                        }
                                        chatId = user._wpChats.find(getChatDetails).chatId

                                        const { existingChat, chatGettingErr } = await getChat({ chatId })
                                        if (chatGettingErr) return callback(chatGettingErr)

                                        if (existingChat._chatParent !== id) return callback('Chat authentication failed...')

                                        const chatUpdates = {
                                            _chatMessages: [...existingChat._chatMessages, {
                                                type: message._data.type,
                                                mimetype: message._data.mimetype,
                                                data: message._data.body,
                                                caption: message._data.caption
                                            }]
                                        }
                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                        socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                        var chatDetails;
                                        var ownChats = user._wpChats
                                        for (let index = 0; index < ownChats.length; index++) {
                                            const element = user._wpChats[index];
                                            if (element.chatId === chatId) {
                                                chatDetails = ownChats.splice(index, 1)
                                                break;
                                            }
                                        }

                                        const orgChat = {
                                            chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: message._data.body,
                                            from: 'client',
                                            chatLabel: updatedChat._chatLabel
                                        }
                                        const userUpdates = {
                                            _wpChats: [orgChat, ...ownChats]
                                        }
                                        const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                        if (errrrr) return callback(errrrr);

                                        socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })

                                        if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                            const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                            if (chatHandler.error) return callback(chatHandler.error)

                                            var chatDetails;
                                            var ownChats = chatHandler.user._wpChats
                                            for (let index = 0; index < ownChats.length; index++) {
                                                const element = chatHandler.user._wpChats[index];
                                                if (element.chatId === chatId) {
                                                    chatDetails = ownChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const orgChat = {
                                                chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                                chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                                chatId: chatDetails[0].chatId,
                                                lastMessage: message._data.body,
                                                from: 'client',
                                                chatLabel: updatedChat._chatLabel
                                            }
                                            const userUpdates = {
                                                _wpChats: [orgChat, ...ownChats]
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                            if (errrrr) return callback(errrrr);

                                            console.log('Emmited to member')
                                            io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                            io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                        }

                                        isChatAlreadyUpdated = true
                                    } else if (!user._wpChats.find(checkChat)) {
                                        console.log("Adding New Chat not found in user  / Authentication....")
                                        const { newChat, chatCreateErr } = await addChat({
                                            chatName: message._data.notifyName,
                                            chatNumber: message._data.author === undefined ? message._data.from : message._data.author,
                                            chatParent: id,
                                            chat: {
                                                type: message._data.type,
                                                mimetype: message._data.mimetype,
                                                data: message._data.body,
                                                caption: message._data.caption
                                            }
                                        })
                                        if (chatCreateErr) return callback(chatCreateErr)
                                        chatId = newChat._id

                                        const { user, error } = await getUsers({ id });
                                        if (error) return callback(error);

                                        var prevChats = newChat._chatMessages
                                        if (user._chatBot) {
                                            for (let index = 0; index < user._chatBotTemplate.length; index++) {
                                                const template = user._chatBotTemplate[index];
                                                if (template.type === 'chat') {
                                                    message.reply(template.data)

                                                    const chatUpdates = {
                                                        _chatMessages: [...prevChats, {
                                                            type: 'chat',
                                                            mimetype: 'chat',
                                                            data: template.data,
                                                            caption: 'SalesBot',
                                                            from: "seller"
                                                        }]
                                                    }
                                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                                    prevChats = updatedChat._chatMessages
                                                } else if (template.type === 'image') {
                                                    const media = new MessageMedia(template.mimetype, template.data.substring(template.data.indexOf(',') + 1))
                                                    clientCopy.sendMessage(newChat._chatNumber, media)


                                                    const chatUpdates = {
                                                        _chatMessages: [...prevChats, {
                                                            type: 'image',
                                                            mimetype: template.mimetype,
                                                            data: template.data.substring(template.data.indexOf(',') + 1),
                                                            caption: 'SalesBot',
                                                            from: "seller"
                                                        }]
                                                    }
                                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                                    prevChats = updatedChat._chatMessages
                                                }
                                            }
                                        }

                                        const date = new Date();
                                        const day = date.getDay()
                                        const totalLeadsGainedThisWeek = JSON.parse(user._totalLeadsGainedThisWeek)
                                        var leadsUpdate;

                                        switch (day) {
                                            case 0:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads + 1
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 1:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads + 1
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 2:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads + 1
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 3:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads + 1
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 4:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads + 1
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 5:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads + 1
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                            case 6:
                                                leadsUpdate = [
                                                    {
                                                        day: 'sun',
                                                        leads: totalLeadsGainedThisWeek[0].leads
                                                    },
                                                    {
                                                        day: 'mon',
                                                        leads: totalLeadsGainedThisWeek[1].leads
                                                    },
                                                    {
                                                        day: 'tue',
                                                        leads: totalLeadsGainedThisWeek[2].leads
                                                    },
                                                    {
                                                        day: 'wed',
                                                        leads: totalLeadsGainedThisWeek[3].leads
                                                    },
                                                    {
                                                        day: 'thu',
                                                        leads: totalLeadsGainedThisWeek[4].leads
                                                    },
                                                    {
                                                        day: 'fri',
                                                        leads: totalLeadsGainedThisWeek[5].leads
                                                    },
                                                    {
                                                        day: 'sat',
                                                        leads: totalLeadsGainedThisWeek[6].leads + 1
                                                    },
                                                    {
                                                        total: totalLeadsGainedThisWeek[7].total + 1
                                                    }
                                                ]
                                                break;
                                        }

                                        if (user._chatBot) {
                                            const userUpdates = {
                                                _wpChats: [{
                                                    chatName: newChat._chatName,
                                                    chatId: newChat._id,
                                                    chatNumber: newChat._chatNumber,
                                                    lastMessage: user._chatBotTemplate[user._chatBotTemplate.length - 1].type === 'chat' ? user._chatBotTemplate[user._chatBotTemplate.length - 1].data : "Image",
                                                    from: 'seller',
                                                    chatLabel: newChat._chatLabel
                                                }, ...user._wpChats],
                                                _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                            if (errrrr) return callback(errrrr);
                                        } else {
                                            const userUpdates = {
                                                _wpChats: [{
                                                    chatName: newChat._chatName,
                                                    chatId: newChat._id,
                                                    chatNumber: newChat._chatNumber,
                                                    lastMessage: message._data.body,
                                                    from: 'client',
                                                    chatLabel: newChat._chatLabel
                                                }, ...user._wpChats],
                                                _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                            if (errrrr) return callback(errrrr);
                                        }

                                        for (let index = 0; index > -1; index++) {
                                            const teamMembers = userTeam._teamMembers;
                                            const memberIndex = Math.floor(Math.random() * ((teamMembers.length - 1) - 1 + 1) + 1)

                                            const memberId = teamMembers[memberIndex].id
                                            const memberRole = teamMembers[memberIndex].role
                                            if (memberRole !== 'admin') {
                                                const teamMember = await getUsers({ id: memberId })
                                                if (teamMember.error) return callback(teamMember.error)

                                                if (teamMember.user._teamRole !== 'seller' || teamMember.user._teamId !== user._teamId) return callback('Member authentication failed...')
                                                if (teamMember.user._wpChats.find(checkChat)) return callback('Chat has been already assigned to the member...')

                                                if (newChat._chatHandlerId === "") {

                                                    const userUpdates2 = {
                                                        _wpChats: [{
                                                            chatName: newChat._chatName,
                                                            chatNumber: newChat._chatNumber,
                                                            chatId: newChat._id,
                                                            from: newChat._chatMessages[newChat._chatMessages.length - 1].from,
                                                            lastMessage: `${newChat._chatMessages[newChat._chatMessages.length - 1].type === 'chat' ? newChat._chatMessages[newChat._chatMessages.length - 1].data : newChat._chatMessages[newChat._chatMessages.length - 1].type === 'image' ? 'Image' : newChat._chatMessages[newChat._chatMessages.length - 1].data}`,
                                                            chatLabel: newChat._chatLabel
                                                        }, ...teamMember.user._wpChats]
                                                    }
                                                    const updatedUser2 = await updateUsers({ id: teamMember.user._id, userUpdates: userUpdates2 })
                                                    if (updatedUser2.errrrr) return callback(updatedUser2.errrrr);

                                                    const chatUpdates = {
                                                        _chatHandlerId: updatedUser2.updatedUser._id,
                                                        _chatHandlerName: updatedUser2.updatedUser._name,
                                                        _chatParentTeam: team._id
                                                    }
                                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                                    io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedUser2.updatedUser, target: updatedUser2.updatedUser._id })
                                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                                    return callback()
                                                }

                                                const chatUpdates = {
                                                    _chatMessages: [...newChat._chatMessages, {
                                                        type: 'note',
                                                        mimetype: 'note',
                                                        data: `The admin assigned the lead to ${teamMember.user._name}`,
                                                        caption: user._name,
                                                        from: "seller"
                                                    }]
                                                }
                                                const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                if (chatUpdationErr) return callback(chatUpdationErr)

                                                break;
                                            } else {
                                                continue
                                            }
                                        }
                                    }

                                    var { existingChat, chatGettingErr } = await getChat({ chatId })
                                    if (chatGettingErr) return callback(chatGettingErr)

                                    var returnedUser = await getUsers({ id });
                                    if (returnedUser.error) return callback(error);

                                    if (returnedUser.user._wpChats.find(checkChat)) {
                                        if (existingChat._chatParent !== id && existingChat._chatParentTeam !== user._teamId && existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')
                                    } else if (returnedUser.user._wpChats.find(checkChat)) {
                                        if (existingChat._chatParent !== id) return callback('Chat authentication failed...')
                                    }

                                    const userDirectories = user._directories
                                    for (let index = 0; index < userDirectories.length; index++) {
                                        const element = userDirectories[index];


                                        const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                        if (directoryGettingErr) return callback(directoryGettingErr)
                                        if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                        if (existingdirectory._allIntegration) {

                                            var directoryChats = existingdirectory._directoryChats
                                            for (let index = 0; index < directoryChats.length; index++) {
                                                const element = directoryChats[index].data;
                                                if (`${element[4].field}@c.us` === existingChat._chatNumber) {
                                                    directoryChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const directoryUpdates = {
                                                _directoryChats: [...directoryChats, {
                                                    data: [{
                                                        field: existingChat._chatDate
                                                    }, {
                                                        field: existingChat._chatPlatform
                                                    }, {
                                                        field: existingChat._chatName
                                                    }, {
                                                        field: existingChat._chatEmail
                                                    }, {
                                                        field: existingChat._chatNumber.substring(0, existingChat._chatNumber.indexOf('@'))
                                                    }, {
                                                        field: existingChat._chatCampaign
                                                    }, {
                                                        field: existingChat._chatBusiness
                                                    }, {
                                                        field: existingChat._chatObjective
                                                    },]
                                                }],
                                            }
                                            const { updatedDirectory } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })

                                            const { updatedChat } = await updateChat({
                                                chatId: existingChat._id, chatUpdates: {
                                                    _chatDirectory: updatedDirectory._directoryName
                                                }
                                            })

                                            existingChat = updatedChat
                                        }
                                    }

                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: returnedUser.user })
                                    socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: existingChat })
                                } else {
                                    return callback('Whatsapp not authenticated...')
                                }
                            }
                            else if (message.hasMedia) {
                                if (message._data.type === 'image') {
                                    console.log("Message with media processing in authentcation...");
                                    var chatId;
                                    var returnedUser;
                                    var isChatAlreadyUpdated = false

                                    var { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    if (user._wpIntegration && user._wpSessionData !== "") {
                                        const clientNumber = message._data.author === undefined ? message._data.from : message._data.author;
                                        const checkChat = (chat) => {
                                            return chat.chatNumber === clientNumber
                                        }
                                        var userTeam

                                        const { user, error } = await getUsers({ id });
                                        if (error) return callback(error);

                                        if (user._teamId !== "" && user._teamRole !== 'neutral') {
                                            var { team, errr } = await getTeam({ teamId: user._teamId });
                                            if (errr) return callback(errr);

                                            if (!team._teamWpIntegration && team._teamWpSessionData === "") return callback('Whatsapp not integrated...')
                                            userTeam = team
                                        }

                                        if (user._wpChats.find(checkChat)) {
                                            const getChatDetails = (chat) => {
                                                if (chat.chatNumber === clientNumber) {
                                                    return chat;
                                                }
                                            }
                                            chatId = user._wpChats.find(getChatDetails).chatId

                                            const { existingChat, chatGettingErr } = await getChat({ chatId })
                                            if (chatGettingErr) return callback(chatGettingErr)

                                            if (existingChat._chatParent !== id) return callback('Chat authentication failed...')


                                            const chatUpdates = {
                                                _chatMessages: [...existingChat._chatMessages, {
                                                    type: message._data.type,
                                                    mimetype: message._data.mimetype,
                                                    data: message._data.body,
                                                    caption: message._data.caption
                                                }]
                                            }
                                            const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                            if (chatUpdationErr) return callback(chatUpdationErr)

                                            socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                            var chatDetails;
                                            var ownChats = user._wpChats
                                            for (let index = 0; index < ownChats.length; index++) {
                                                const element = user._wpChats[index];
                                                if (element.chatId === chatId) {
                                                    chatDetails = ownChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const orgChat = {
                                                chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                                chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                                chatId: chatDetails[0].chatId,
                                                lastMessage: 'Image',
                                                from: 'client',
                                                chatLabel: updatedChat._chatLabel
                                            }
                                            const userUpdates = {
                                                _wpChats: [orgChat, ...ownChats]
                                            }
                                            const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                            if (errrrr) return callback(errrrr);

                                            socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })

                                            if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                                const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                                if (chatHandler.error) return callback(chatHandler.error)

                                                var chatDetails;
                                                var ownChats = chatHandler.user._wpChats
                                                for (let index = 0; index < ownChats.length; index++) {
                                                    const element = chatHandler.user._wpChats[index];
                                                    if (element.chatId === chatId) {
                                                        chatDetails = ownChats.splice(index, 1)
                                                        break;
                                                    }
                                                }

                                                const orgChat = {
                                                    chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                                    chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                                    chatId: chatDetails[0].chatId,
                                                    lastMessage: 'Image',
                                                    from: 'client',
                                                    chatLabel: updatedChat._chatLabel
                                                }
                                                const userUpdates = {
                                                    _wpChats: [orgChat, ...ownChats]
                                                }
                                                const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                                if (errrrr) return callback(errrrr);

                                                io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                                io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                            }

                                            isChatAlreadyUpdated = true
                                        } else if (!user._wpChats.find(checkChat)) {
                                            console.log("Adding Chat....")
                                            const { newChat, chatCreateErr } = await addChat({
                                                chatName: message._data.notifyName,
                                                chatNumber: message._data.author === undefined ? message._data.from : message._data.author,
                                                chatParent: id,
                                                chat: {
                                                    type: message._data.type,
                                                    mimetype: message._data.mimetype,
                                                    data: message._data.body,
                                                    caption: message._data.caption
                                                }
                                            })
                                            if (chatCreateErr) return callback(chatCreateErr)
                                            chatId = newChat._id

                                            const { user, error } = await getUsers({ id });
                                            if (error) return callback(error);

                                            const userDirectories = user._directories
                                            for (let index = 0; index < userDirectories.length; index++) {
                                                const element = userDirectories[index];


                                                const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                                if (directoryGettingErr) return callback(directoryGettingErr)
                                                if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                                if (existingdirectory._allIntegration) {

                                                    var directoryChats = existingdirectory._directoryChats
                                                    for (let index = 0; index < directoryChats.length; index++) {
                                                        const element = directoryChats[index].data;
                                                        if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                            directoryChats.splice(index, 1)
                                                            break;
                                                        }
                                                    }

                                                    const directoryUpdates = {
                                                        _directoryChats: [...directoryChats, {
                                                            data: [{
                                                                field: newChat._chatDate
                                                            }, {
                                                                field: newChat._chatPlatform
                                                            }, {
                                                                field: newChat._chatName
                                                            }, {
                                                                field: newChat._chatEmail
                                                            }, {
                                                                field: newChat._chatNumber.substring(0, newChat._chatNumber.indexOf('@'))
                                                            }, {
                                                                field: newChat._chatCampaign
                                                            }, {
                                                                field: newChat._chatBusiness
                                                            }, {
                                                                field: newChat._chatObjective
                                                            },]
                                                        }],
                                                    }
                                                    const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                                    if (directoryUpdationErr) return callback(directoryUpdationErr);
                                                    console.log(directoryUpdates)
                                                }
                                            }

                                            var prevChats = newChat._chatMessages
                                            if (user._chatBot) {
                                                for (let index = 0; index < user._chatBotTemplate.length; index++) {
                                                    const template = user._chatBotTemplate[index];
                                                    if (template.type === 'chat') {
                                                        message.reply(template.data)

                                                        const chatUpdates = {
                                                            _chatMessages: [...prevChats, {
                                                                type: 'chat',
                                                                mimetype: 'chat',
                                                                data: template.data,
                                                                caption: 'SalesBot',
                                                                from: "seller"
                                                            }]
                                                        }
                                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                                        prevChats = updatedChat._chatMessages
                                                    } else if (template.type === 'image') {
                                                        const media = new MessageMedia(template.mimetype, template.data.substring(template.data.indexOf(',') + 1))
                                                        clientCopy.sendMessage(newChat._chatNumber, media)


                                                        const chatUpdates = {
                                                            _chatMessages: [...prevChats, {
                                                                type: 'image',
                                                                mimetype: template.mimetype,
                                                                data: template.data.substring(template.data.indexOf(',') + 1),
                                                                caption: 'SalesBot',
                                                                from: "seller"
                                                            }]
                                                        }
                                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                                        prevChats = updatedChat._chatMessages
                                                    }
                                                }
                                            }

                                            const date = new Date();
                                            const day = date.getDay()
                                            const totalLeadsGainedThisWeek = JSON.parse(user._totalLeadsGainedThisWeek)
                                            var leadsUpdate;

                                            switch (day) {
                                                case 0:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads + 1
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 1:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads + 1
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 2:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads + 1
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 3:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads + 1
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 4:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads + 1
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 5:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads + 1
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                                case 6:
                                                    leadsUpdate = [
                                                        {
                                                            day: 'sun',
                                                            leads: totalLeadsGainedThisWeek[0].leads
                                                        },
                                                        {
                                                            day: 'mon',
                                                            leads: totalLeadsGainedThisWeek[1].leads
                                                        },
                                                        {
                                                            day: 'tue',
                                                            leads: totalLeadsGainedThisWeek[2].leads
                                                        },
                                                        {
                                                            day: 'wed',
                                                            leads: totalLeadsGainedThisWeek[3].leads
                                                        },
                                                        {
                                                            day: 'thu',
                                                            leads: totalLeadsGainedThisWeek[4].leads
                                                        },
                                                        {
                                                            day: 'fri',
                                                            leads: totalLeadsGainedThisWeek[5].leads
                                                        },
                                                        {
                                                            day: 'sat',
                                                            leads: totalLeadsGainedThisWeek[6].leads + 1
                                                        },
                                                        {
                                                            total: totalLeadsGainedThisWeek[7].total + 1
                                                        }
                                                    ]
                                                    break;
                                            }

                                            if (user._chatBot) {
                                                const userUpdates = {
                                                    _wpChats: [{
                                                        chatName: newChat._chatName,
                                                        chatId: newChat._id,
                                                        chatNumber: newChat._chatNumber,
                                                        lastMessage: user._chatBotTemplate[user._chatBotTemplate.length - 1].type === 'chat' ? user._chatBotTemplate[user._chatBotTemplate.length - 1].data : "Image",
                                                        from: 'seller',
                                                        chatLabel: newChat._chatLabel
                                                    }, ...user._wpChats],
                                                    _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                                }
                                                const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                                if (errrrr) return callback(errrrr);
                                            } else {
                                                const userUpdates = {
                                                    _wpChats: [{
                                                        chatName: newChat._chatName,
                                                        chatId: newChat._id,
                                                        chatNumber: newChat._chatNumber,
                                                        lastMessage: 'Image',
                                                        from: 'client',
                                                        chatLabel: newChat._chatLabel
                                                    }, ...user._wpChats],
                                                    _totalLeadsGainedThisWeek: JSON.stringify(leadsUpdate)
                                                }
                                                const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                                if (errrrr) return callback(errrrr);
                                            }

                                            for (let index = 0; index > -1; index++) {
                                                const teamMembers = userTeam._teamMembers;
                                                const memberIndex = Math.floor(Math.random() * ((teamMembers.length - 1) - 1 + 1) + 1)

                                                const memberId = teamMembers[memberIndex].id
                                                const memberRole = teamMembers[memberIndex].role
                                                if (memberRole !== 'admin') {
                                                    const teamMember = await getUsers({ id: memberId })
                                                    if (teamMember.error) return callback(teamMember.error)

                                                    if (teamMember.user._teamRole !== 'seller' || teamMember.user._teamId !== user._teamId) return callback('Member authentication failed...')
                                                    if (teamMember.user._wpChats.find(checkChat)) return callback('Chat has been already assigned to the member...')

                                                    if (newChat._chatHandlerId === "") {

                                                        const userUpdates2 = {
                                                            _wpChats: [{
                                                                chatName: newChat._chatName,
                                                                chatNumber: newChat._chatNumber,
                                                                chatId: newChat._id,
                                                                from: newChat._chatMessages[newChat._chatMessages.length - 1].from,
                                                                lastMessage: `${newChat._chatMessages[newChat._chatMessages.length - 1].type === 'chat' ? newChat._chatMessages[newChat._chatMessages.length - 1].data : newChat._chatMessages[newChat._chatMessages.length - 1].type === 'image' ? 'Image' : newChat._chatMessages[newChat._chatMessages.length - 1].data}`,
                                                                chatLabel: newChat._chatLabel
                                                            }, ...teamMember.user._wpChats]
                                                        }
                                                        const updatedUser2 = await updateUsers({ id: teamMember.user._id, userUpdates: userUpdates2 })
                                                        if (updatedUser2.errrrr) return callback(updatedUser2.errrrr);

                                                        const chatUpdates = {
                                                            _chatHandlerId: updatedUser2.updatedUser._id,
                                                            _chatHandlerName: updatedUser2.updatedUser._name,
                                                            _chatParentTeam: team._id
                                                        }
                                                        const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                        if (chatUpdationErr) return callback(chatUpdationErr)

                                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedUser2.updatedUser, target: updatedUser2.updatedUser._id })
                                                        socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                                        return callback()
                                                    }

                                                    const chatUpdates = {
                                                        _chatMessages: [...newChat._chatMessages, {
                                                            type: 'note',
                                                            mimetype: 'note',
                                                            data: `The admin assigned the lead to ${teamMember.user._name}`,
                                                            caption: user._name,
                                                            from: "seller"
                                                        }]
                                                    }
                                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                                    break;
                                                } else {
                                                    continue
                                                }
                                            }
                                        }

                                        // if (user._wpChats.find(checkChat)) {
                                        //     console.log("Updating the assigned chats from start...")
                                        //     const getChatDetails = (chat) => {
                                        //         if (chat.chatNumber === clientNumber) {
                                        //             return chat;
                                        //         }
                                        //     }
                                        //     chatId = user._wpChats.find(getChatDetails).chatId

                                        //     const { existingChat, chatGettingErr } = await getChat({ chatId })
                                        //     if (chatGettingErr) return callback(chatGettingErr)

                                        //     if (existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')
                                        //     if (existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')
                                        //     var globalChat = existingChat

                                        //     const chatUpdates = {
                                        //         _chatMessages: [...existingChat._chatMessages, {
                                        //             type: message._data.type,
                                        //             mimetype: message._data.mimetype,
                                        //             data: message._data.body,
                                        //             caption: message._data.caption
                                        //         }]
                                        //     }
                                        //     const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                        //     if (chatUpdationErr) return callback(chatUpdationErr)

                                        //     globalChat = updatedChat

                                        //     socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })


                                        //     var chatDetails;
                                        //     var ownChats = user._wpChats
                                        //     for (let index = 0; index < ownChats.length; index++) {
                                        //         const element = user._wpChats[index];
                                        //         if (element.chatId === chatId) {
                                        //             chatDetails = ownChats.splice(index, 1)
                                        //             break;
                                        //         }
                                        //     }

                                        //     const orgChat = {
                                        //         chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                        //         chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                        //         chatId: chatDetails[0].chatId,
                                        //         lastMessage: 'Image',
                                        //         from: 'client',
                                        //         chatLabel: existingChat._chatLabel
                                        //     }
                                        //     const userUpdates = {
                                        //         _wpChats: [orgChat, ...ownChats]
                                        //     }
                                        //     const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                        //     if (errrrr) return callback(errrrr);

                                        //     socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })

                                        //     const teamAdmin = await getUsers({ id: userTeam._teamAdmin })
                                        //     if (teamAdmin.error) return callback(teamAdmin.error)

                                        //     var chatDetails2;
                                        //     var ownChats2 = teamAdmin.user._wpChats
                                        //     for (let index = 0; index < ownChats2.length; index++) {
                                        //         const element = teamAdmin.user._wpChats[index];
                                        //         if (element.chatId === chatId) {
                                        //             chatDetails2 = ownChats2.splice(index, 1)
                                        //             break;
                                        //         }
                                        //     }

                                        //     const orgChat2 = {
                                        //         chatName: chatDetails2[0].chatName === "" ? "Unknown Contact" : chatDetails2[0].chatName,
                                        //         chatNumber: chatDetails2[0].chatNumber === "" ? "Unknown Number" : chatDetails2[0].chatNumber,
                                        //         chatId: chatDetails2[0].chatId,
                                        //         lastMessage: 'Image',
                                        //         from: 'client',
                                        //         chatLabel: existingChat._chatLabel
                                        //     }
                                        //     const userUpdates2 = {
                                        //         _wpChats: [orgChat2, ...ownChats2]
                                        //     }
                                        //     const updatedTeamAdmin = await updateUsers({ id: teamAdmin.user._id, userUpdates: userUpdates2 })
                                        //     if (updatedTeamAdmin.errrrr) return callback(updatedTeamAdmin.errrrr);

                                        //     io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedTeamAdmin.updatedUser, target: updatedTeamAdmin.updatedUser._id })
                                        //     io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: globalChat, target: updatedTeamAdmin.updatedUser._id })
                                        // }

                                        var { existingChat, chatGettingErr } = await getChat({ chatId })
                                        if (chatGettingErr) return callback(chatGettingErr)

                                        if (existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')

                                        var returnedUser = await getUsers({ id });
                                        if (returnedUser.error) return callback(error);

                                        const userDirectories = user._directories
                                        for (let index = 0; index < userDirectories.length; index++) {
                                            const element = userDirectories[index];


                                            const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                            if (directoryGettingErr) return callback(directoryGettingErr)
                                            if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                            if (existingdirectory._allIntegration) {

                                                var directoryChats = existingdirectory._directoryChats
                                                for (let index = 0; index < directoryChats.length; index++) {
                                                    const element = directoryChats[index].data;
                                                    if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                        directoryChats.splice(index, 1)
                                                        break;
                                                    }
                                                }

                                                const directoryUpdates = {
                                                    _directoryChats: [...directoryChats, {
                                                        data: [{
                                                            field: existingChat._chatDate
                                                        }, {
                                                            field: existingChat._chatPlatform
                                                        }, {
                                                            field: existingChat._chatName
                                                        }, {
                                                            field: existingChat._chatEmail
                                                        }, {
                                                            field: existingChat._chatNumber.substring(0, existingChat._chatNumber.indexOf('@'))
                                                        }, {
                                                            field: existingChat._chatCampaign
                                                        }, {
                                                            field: existingChat._chatBusiness
                                                        }, {
                                                            field: existingChat._chatObjective
                                                        },]
                                                    }],
                                                }
                                                const { updatedDirectory } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })

                                                const { updatedChat } = await updateChat({
                                                    chatId: existingChat._id, chatUpdates: {
                                                        _chatDirectory: updatedDirectory._directoryName
                                                    }
                                                })

                                                existingChat = updatedChat
                                            }
                                        }


                                        socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: returnedUser.user })
                                        socket.emit("whatsapp_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: existingChat })
                                    }
                                } else {
                                    console.log('Message ignored due to some unsupported media...')
                                }
                            }
                        }
                    })

                    if (!client_wp_sessions.find(checkActiveSession)) {
                        client.initialize()
                    }
                } else {
                    callback('Access denied...')
                }
            } catch (err) {
                console.log(err)
                return callback('Internal server error...')
            }
        })

        socket.on("send_message", async ({ isImage, authToken, password, clientNumber, message, permission, clientName, clientEmail, clientBusiness, clientCampaign, clientObjective, clientPlatform, chatDirectory }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    var team;
                    var userTeam;
                    var flag = false
                    var isChatAlreadyUpdated = false

                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);
                    const username = user._name
                    const userDirectories = user._directories

                    if (user._teamRole !== 'neutral') {
                        var { team, errr } = await getTeam({ teamId: user._teamId });
                        if (errr) return callback(errr);
                        this.team = team
                        userTeam = team
                        flag = true
                    }

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (!flag) {
                        if (user._wpIntegration && user._wpSessionData !== "" && permission) {
                            const checkChat = (chat) => {
                                return chat.chatNumber === clientNumber;
                            }
                            if (!isImage) {
                                if (!user._wpChats.find(checkChat)) {
                                    const { newChat, chatCreateErr } = await createChat({ chatName: clientName, chatNumber: clientNumber, chatEmail: clientEmail, chatBusiness: clientBusiness, chatObjective: clientObjective, chatPlatform: clientPlatform, chatCampaign: clientCampaign, chatParent: id, chatDirectory: chatDirectory })
                                    if (chatCreateErr) return callback(chatCreateErr)

                                    if (newChat._chatParent !== id) return callback('Chat authentication failed...')
                                    clientCopy.sendMessage(clientNumber, message)


                                    for (let index = 0; index < userDirectories.length; index++) {
                                        const element = userDirectories[index];


                                        const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                        if (directoryGettingErr) return callback(directoryGettingErr)
                                        if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                        if (existingdirectory._allIntegration) {

                                            var directoryChats = existingdirectory._directoryChats
                                            for (let index = 0; index < directoryChats.length; index++) {
                                                const element = directoryChats[index].data;
                                                if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                    directoryChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const directoryUpdates = {
                                                _directoryChats: [...directoryChats, {
                                                    data: [{
                                                        field: newChat._chatDate
                                                    }, {
                                                        field: newChat._chatPlatform
                                                    }, {
                                                        field: newChat._chatName
                                                    }, {
                                                        field: newChat._chatEmail
                                                    }, {
                                                        field: newChat._chatNumber.substring(0, newChat._chatNumber.indexOf('@'))
                                                    }, {
                                                        field: newChat._chatCampaign
                                                    }, {
                                                        field: newChat._chatBusiness
                                                    }, {
                                                        field: newChat._chatObjective
                                                    },]
                                                }],
                                            }
                                            const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                            if (directoryUpdationErr) return callback(directoryUpdationErr);
                                            console.log(directoryUpdates)
                                        }
                                    }

                                    const chatUpdates = {
                                        _chatMessages: [...newChat._chatMessages, {
                                            type: 'chat',
                                            mimetype: 'chat',
                                            data: message,
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    const { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: newChat._chatName,
                                            chatNumber: newChat._chatNumber,
                                            chatId: newChat._id,
                                            lastMessage: message,
                                            from: 'seller',
                                            chatLabel: 'Neutral'
                                        }, ...user._wpChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);


                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                    return callback()
                                } else if (user._wpChats.find(checkChat)) {
                                    console.log('Got Request from directory')
                                    const getChatDetails = (chat) => {
                                        if (chat.chatNumber === clientNumber) {
                                            return chat
                                        }
                                    }
                                    const foundChat = user._wpChats.find(getChatDetails);

                                    const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                    if (chatGettingErr) return callback(chatGettingErr)

                                    if (existingChat._chatParent !== id) return callback('Chat authentication failed...')

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    clientCopy.sendMessage(clientNumber, message)

                                    const chatUpdates = {
                                        _chatMessages: [...existingChat._chatMessages, {
                                            type: 'chat',
                                            mimetype: 'chat',
                                            data: message,
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    var chatDetails;
                                    var ownChats = user._wpChats
                                    var chatId = JSON.stringify(updatedChat._id)
                                    for (let index = 0; index < ownChats.length; index++) {
                                        const element = ownChats[index];
                                        if (`"${element.chatId}"` === chatId) {
                                            chatDetails = ownChats.splice(index, 1)
                                            break;
                                        }
                                    }
                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: message,
                                            from: "seller",
                                            chatLabel: updatedChat._chatLabel
                                        }, ...ownChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);

                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                        const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                        if (chatHandler.error) return callback(chatHandler.error)

                                        var chatDetails;
                                        var ownChats5 = chatHandler.user._wpChats
                                        var chatId = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats5.length; index++) {
                                            const element = chatHandler.user._wpChats[index];
                                            if (`"${element.chatId}"` === chatId) {
                                                chatDetails = ownChats5.splice(index, 1)
                                                break;
                                            }
                                        }

                                        const orgChat = {
                                            chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: message,
                                            from: 'client',
                                            chatLabel: updatedChat._chatLabel
                                        }
                                        const userUpdates = {
                                            _wpChats: [orgChat, ...ownChats5]
                                        }
                                        const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                        if (errrrr) return callback(errrrr);

                                        console.log('Emmited to member')
                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                        io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                    } else if (updatedChat._chatHandlerId === id) {
                                        const teamAdmin = await getUsers({ id: userTeam._teamAdmin })
                                        if (teamAdmin.error) return callback(teamAdmin.error)

                                        var chatDetails2;
                                        var ownChats2 = teamAdmin.user._wpChats
                                        var chatId2 = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats2.length; index++) {
                                            const element = ownChats2[index];
                                            if (`"${element.chatId}"` === chatId2) {
                                                chatDetails2 = ownChats2.splice(index, 1)
                                                break;
                                            }
                                        }
                                        const userUpdates2 = {
                                            _wpChats: [{
                                                chatName: chatDetails2[0].chatName,
                                                chatNumber: chatDetails2[0].chatNumber,
                                                chatId: chatDetails2[0].chatId,
                                                lastMessage: message,
                                                from: "seller",
                                                chatLabel: updatedChat._chatLabel
                                            }, ...ownChats2],
                                        }
                                        const updatedTeamAdmin = await updateUsers({ id: teamAdmin.user._id, userUpdates: userUpdates2 })
                                        if (updatedTeamAdmin.errrrr) return callback(updatedTeamAdmin.errrrr);

                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedTeamAdmin.updatedUser, target: updatedTeamAdmin.updatedUser._id })
                                        io.to(user._teamId).emit("sent_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedTeamAdmin.updatedUser._id })
                                        return callback()
                                    }

                                    isChatAlreadyUpdated = true
                                }
                            } else if (isImage) {
                                if (!user._wpChats.find(checkChat)) {
                                    const { newChat, chatCreateErr } = await createChat({ chatName: clientName, chatNumber: clientNumber, chatEmail: clientEmail, chatBusiness: clientBusiness, chatObjective: clientObjective, chatPlatform: clientPlatform, chatCampaign: clientCampaign, chatParent: id })
                                    if (chatCreateErr) return callback(chatCreateErr)


                                    for (let index = 0; index < userDirectories.length; index++) {
                                        const element = userDirectories[index];


                                        const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                        if (directoryGettingErr) return callback(directoryGettingErr)
                                        if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                        if (existingdirectory._allIntegration) {

                                            var directoryChats = existingdirectory._directoryChats
                                            for (let index = 0; index < directoryChats.length; index++) {
                                                const element = directoryChats[index].data;
                                                if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                    directoryChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const directoryUpdates = {
                                                _directoryChats: [...directoryChats, {
                                                    data: [{
                                                        field: newChat._chatDate
                                                    }, {
                                                        field: newChat._chatPlatform
                                                    }, {
                                                        field: newChat._chatName
                                                    }, {
                                                        field: newChat._chatEmail
                                                    }, {
                                                        field: newChat._chatNumber.substring(0, newChat._chatNumber.indexOf('@'))
                                                    }, {
                                                        field: newChat._chatCampaign
                                                    }, {
                                                        field: newChat._chatBusiness
                                                    }, {
                                                        field: newChat._chatObjective
                                                    },]
                                                }],
                                            }
                                            const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                            if (directoryUpdationErr) return callback(directoryUpdationErr);
                                            console.log(directoryUpdates)
                                        }
                                    }


                                    const media = new MessageMedia(message.substring(message.indexOf(':') + 1, message.indexOf(';')), message.substring(message.indexOf(',') + 1))
                                    clientCopy.sendMessage(clientNumber, media)
                                    if (newChat._chatParent !== id) return callback('Chat authentication failed...')

                                    const chatUpdates = {
                                        _chatMessages: [...newChat._chatMessages, {
                                            type: 'image',
                                            mimetype: message.substring(message.indexOf(':') + 1, message.indexOf(';')),
                                            data: message.substring(message.indexOf(',') + 1),
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    const { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: newChat._chatName,
                                            chatNumber: newChat._chatNumber,
                                            chatId: newChat._id,
                                            lastMessage: 'Image',
                                            from: 'seller',
                                            chatLabel: 'Neutral'
                                        }, ...user._wpChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);


                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                    return callback()
                                } else if (user._wpChats.find(checkChat)) {
                                    const getChatDetails = (chat) => {
                                        if (chat.chatNumber === clientNumber) {
                                            return chat
                                        }
                                    }
                                    const foundChat = user._wpChats.find(getChatDetails);

                                    const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                    if (chatGettingErr) return callback(chatGettingErr)

                                    if (existingChat._chatParent !== id) return callback('Chat authentication failed...')

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    const media = new MessageMedia(message.substring(message.indexOf(':') + 1, message.indexOf(';')), message.substring(message.indexOf(',') + 1))
                                    clientCopy.sendMessage(clientNumber, media)

                                    const chatUpdates = {
                                        _chatMessages: [...existingChat._chatMessages, {
                                            type: 'image',
                                            mimetype: message.substring(message.indexOf(':') + 1, message.indexOf(';')),
                                            data: message.substring(message.indexOf(',') + 1),
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    var chatDetails;
                                    var ownChats = user._wpChats
                                    var chatId = JSON.stringify(updatedChat._id)
                                    for (let index = 0; index < ownChats.length; index++) {
                                        const element = ownChats[index];
                                        if (`"${element.chatId}"` === chatId) {
                                            chatDetails = ownChats.splice(index, 1)
                                            break;
                                        }
                                    }
                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: 'Image',
                                            from: "seller",
                                            chatLabel: updatedChat._chatLabel
                                        }, ...ownChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);

                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                        const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                        if (chatHandler.error) return callback(chatHandler.error)

                                        var chatDetails;
                                        var ownChats4 = chatHandler.user._wpChats
                                        var chatId = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats4.length; index++) {
                                            const element = chatHandler.user._wpChats[index];
                                            if (`"${element.chatId}"` === chatId) {
                                                chatDetails = ownChats4.splice(index, 1)
                                                break;
                                            }
                                        }

                                        const orgChat = {
                                            chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: 'Image',
                                            from: 'client',
                                            chatLabel: updatedChat._chatLabel
                                        }
                                        const userUpdates = {
                                            _wpChats: [orgChat, ...ownChats4]
                                        }
                                        const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                        if (errrrr) return callback(errrrr);

                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                        io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                    } else if (updatedChat._chatHandlerId === id) {
                                        const teamAdmin = await getUsers({ id: userTeam._teamAdmin })
                                        if (teamAdmin.error) return callback(teamAdmin.error)

                                        var chatDetails2;
                                        var ownChats2 = teamAdmin.user._wpChats
                                        var chatId2 = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats2.length; index++) {
                                            const element = ownChats2[index];
                                            if (`"${element.chatId}"` === chatId2) {
                                                chatDetails2 = ownChats2.splice(index, 1)
                                                break;
                                            }
                                        }
                                        const userUpdates2 = {
                                            _wpChats: [{
                                                chatName: chatDetails2[0].chatName,
                                                chatNumber: chatDetails2[0].chatNumber,
                                                chatId: chatDetails2[0].chatId,
                                                lastMessage: 'Image',
                                                from: "seller",
                                                chatLabel: updatedChat._chatLabel
                                            }, ...ownChats2],
                                        }
                                        const updatedTeamAdmin = await updateUsers({ id: teamAdmin.user._id, userUpdates: userUpdates2 })
                                        if (updatedTeamAdmin.errrrr) return callback(updatedTeamAdmin.errrrr);

                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedTeamAdmin.updatedUser, target: updatedTeamAdmin.updatedUser._id })
                                        io.to(user._teamId).emit("sent_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedTeamAdmin.updatedUser._id })
                                    }

                                    isChatAlreadyUpdated = true
                                }
                            }

                            return callback()
                        } else {
                            return callback('Whatsapp not authenticated...')
                        }
                    } else if (flag) {
                        if (userTeam._teamWpIntegration && userTeam._teamWpSessionData !== "" && permission) {
                            const checkChat = (chat) => {
                                return chat.chatNumber === clientNumber;
                            }
                            if (!isImage) {
                                if (!user._wpChats.find(checkChat)) {
                                    const { newChat, chatCreateErr } = await createChat({ chatName: clientName, chatNumber: clientNumber, chatEmail: clientEmail, chatBusiness: clientBusiness, chatObjective: clientObjective, chatPlatform: clientPlatform, chatCampaign: clientCampaign, chatParent: id, chatDirectory: chatDirectory })
                                    if (chatCreateErr) return callback(chatCreateErr)

                                    if (newChat._chatParent !== id) return callback('Chat authentication failed...')
                                    clientCopy.sendMessage(clientNumber, message)

                                    for (let index = 0; index < userDirectories.length; index++) {
                                        const element = userDirectories[index];


                                        const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                        if (directoryGettingErr) return callback(directoryGettingErr)
                                        if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                        if (existingdirectory._allIntegration) {

                                            var directoryChats = existingdirectory._directoryChats
                                            for (let index = 0; index < directoryChats.length; index++) {
                                                const element = directoryChats[index].data;
                                                if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                    directoryChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const directoryUpdates = {
                                                _directoryChats: [...directoryChats, {
                                                    data: [{
                                                        field: newChat._chatDate
                                                    }, {
                                                        field: newChat._chatPlatform
                                                    }, {
                                                        field: newChat._chatName
                                                    }, {
                                                        field: newChat._chatEmail
                                                    }, {
                                                        field: newChat._chatNumber.substring(0, newChat._chatNumber.indexOf('@'))
                                                    }, {
                                                        field: newChat._chatCampaign
                                                    }, {
                                                        field: newChat._chatBusiness
                                                    }, {
                                                        field: newChat._chatObjective
                                                    },]
                                                }],
                                            }
                                            const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                            if (directoryUpdationErr) return callback(directoryUpdationErr);
                                            console.log(directoryUpdates)
                                        }
                                    }

                                    const chatUpdates = {
                                        _chatMessages: [...newChat._chatMessages, {
                                            type: 'chat',
                                            mimetype: 'chat',
                                            data: message,
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    const { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: newChat._chatName,
                                            chatNumber: newChat._chatNumber,
                                            chatId: newChat._id,
                                            lastMessage: message,
                                            from: 'seller',
                                            chatLabel: 'Neutral'
                                        }, ...user._wpChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);


                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                    return callback()
                                } else if (user._wpChats.find(checkChat)) {
                                    console.log('Got Request from directory')
                                    const getChatDetails = (chat) => {
                                        if (chat.chatNumber === clientNumber) {
                                            return chat
                                        }
                                    }
                                    const foundChat = user._wpChats.find(getChatDetails);

                                    const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                    if (chatGettingErr) return callback(chatGettingErr)

                                    if (existingChat._chatParent !== id && existingChat._chatHandlerId !== id && existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    clientCopy.sendMessage(clientNumber, message)

                                    const chatUpdates = {
                                        _chatMessages: [...existingChat._chatMessages, {
                                            type: 'chat',
                                            mimetype: 'chat',
                                            data: message,
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    var chatDetails;
                                    var ownChats = user._wpChats
                                    var chatId = JSON.stringify(updatedChat._id)
                                    for (let index = 0; index < ownChats.length; index++) {
                                        const element = ownChats[index];
                                        if (`"${element.chatId}"` === chatId) {
                                            chatDetails = ownChats.splice(index, 1)
                                            break;
                                        }
                                    }
                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: message,
                                            from: "seller",
                                            chatLabel: updatedChat._chatLabel
                                        }, ...ownChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);

                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                        const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                        if (chatHandler.error) return callback(chatHandler.error)

                                        var chatDetails;
                                        var ownChats5 = chatHandler.user._wpChats
                                        var chatId = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats5.length; index++) {
                                            const element = chatHandler.user._wpChats[index];
                                            if (`"${element.chatId}"` === chatId) {
                                                chatDetails = ownChats5.splice(index, 1)
                                                break;
                                            }
                                        }

                                        const orgChat = {
                                            chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: message,
                                            from: 'client',
                                            chatLabel: updatedChat._chatLabel
                                        }
                                        const userUpdates = {
                                            _wpChats: [orgChat, ...ownChats5]
                                        }
                                        const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                        if (errrrr) return callback(errrrr);

                                        console.log('Emmited to member')
                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                        io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                    } else if (updatedChat._chatHandlerId === id) {
                                        const teamAdmin = await getUsers({ id: userTeam._teamAdmin })
                                        if (teamAdmin.error) return callback(teamAdmin.error)

                                        var chatDetails2;
                                        var ownChats2 = teamAdmin.user._wpChats
                                        var chatId2 = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats2.length; index++) {
                                            const element = ownChats2[index];
                                            if (`"${element.chatId}"` === chatId2) {
                                                chatDetails2 = ownChats2.splice(index, 1)
                                                break;
                                            }
                                        }
                                        const userUpdates2 = {
                                            _wpChats: [{
                                                chatName: chatDetails2[0].chatName,
                                                chatNumber: chatDetails2[0].chatNumber,
                                                chatId: chatDetails2[0].chatId,
                                                lastMessage: message,
                                                from: "seller",
                                                chatLabel: updatedChat._chatLabel
                                            }, ...ownChats2],
                                        }
                                        const updatedTeamAdmin = await updateUsers({ id: teamAdmin.user._id, userUpdates: userUpdates2 })
                                        if (updatedTeamAdmin.errrrr) return callback(updatedTeamAdmin.errrrr);

                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedTeamAdmin.updatedUser, target: updatedTeamAdmin.updatedUser._id })
                                        io.to(user._teamId).emit("sent_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedTeamAdmin.updatedUser._id })
                                        return callback()
                                    }

                                    isChatAlreadyUpdated = true
                                }
                            } else if (isImage) {
                                if (!user._wpChats.find(checkChat)) {
                                    const { newChat, chatCreateErr } = await createChat({ chatName: clientName, chatNumber: clientNumber, chatEmail: clientEmail, chatBusiness: clientBusiness, chatObjective: clientObjective, chatPlatform: clientPlatform, chatCampaign: clientCampaign, chatParent: id })
                                    if (chatCreateErr) return callback(chatCreateErr)


                                    for (let index = 0; index < userDirectories.length; index++) {
                                        const element = userDirectories[index];


                                        const { existingdirectory, directoryGettingErr } = await getDirectory({ directoryId: element.directoryId })
                                        if (directoryGettingErr) return callback(directoryGettingErr)
                                        if (!existingdirectory._directoryParent === id) return callback('Directory authentication failed')

                                        if (existingdirectory._allIntegration) {

                                            var directoryChats = existingdirectory._directoryChats
                                            for (let index = 0; index < directoryChats.length; index++) {
                                                const element = directoryChats[index].data;
                                                if (`${element[4].field}@c.us` === newChat._chatNumber) {
                                                    directoryChats.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const directoryUpdates = {
                                                _directoryChats: [...directoryChats, {
                                                    data: [{
                                                        field: newChat._chatDate
                                                    }, {
                                                        field: newChat._chatPlatform
                                                    }, {
                                                        field: newChat._chatName
                                                    }, {
                                                        field: newChat._chatEmail
                                                    }, {
                                                        field: newChat._chatNumber.substring(0, newChat._chatNumber.indexOf('@'))
                                                    }, {
                                                        field: newChat._chatCampaign
                                                    }, {
                                                        field: newChat._chatBusiness
                                                    }, {
                                                        field: newChat._chatObjective
                                                    },]
                                                }],
                                            }
                                            const { updatedDirectory, directoryUpdationErr } = await updateDirectory({ directoryId: existingdirectory._id, directoryUpdates })
                                            if (directoryUpdationErr) return callback(directoryUpdationErr);
                                            console.log(directoryUpdates)
                                        }
                                    }


                                    const media = new MessageMedia(message.substring(message.indexOf(':') + 1, message.indexOf(';')), message.substring(message.indexOf(',') + 1))
                                    clientCopy.sendMessage(clientNumber, media)
                                    if (newChat._chatParent !== id) return callback('Chat authentication failed...')

                                    const chatUpdates = {
                                        _chatMessages: [...newChat._chatMessages, {
                                            type: 'image',
                                            mimetype: message.substring(message.indexOf(':') + 1, message.indexOf(';')),
                                            data: message.substring(message.indexOf(',') + 1),
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: newChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    socket.emit("got_chat_details", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    const { user, error } = await getUsers({ id });
                                    if (error) return callback(error);

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: newChat._chatName,
                                            chatNumber: newChat._chatNumber,
                                            chatId: newChat._id,
                                            lastMessage: 'Image',
                                            from: 'seller',
                                            chatLabel: 'Neutral'
                                        }, ...user._wpChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);


                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                    return callback()
                                } else if (user._wpChats.find(checkChat)) {
                                    const getChatDetails = (chat) => {
                                        if (chat.chatNumber === clientNumber) {
                                            return chat
                                        }
                                    }
                                    const foundChat = user._wpChats.find(getChatDetails);

                                    const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                    if (chatGettingErr) return callback(chatGettingErr)

                                    if (existingChat._chatParent !== id && existingChat._chatHandlerId !== id && existingChat._chatParentTeam !== user._teamId) return callback('Chat authentication failed...')

                                    const date = new Date();
                                    const day = date.getDay()
                                    const totalMessagesSentThisWeek = JSON.parse(user._totalMessagesSentThisWeek)
                                    var chatsUpdate;

                                    switch (day) {
                                        case 0:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats + 1
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 1:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats + 1
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 2:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats + 1
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 3:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats + 1
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 4:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats + 1
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 5:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats + 1
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                        case 6:
                                            chatsUpdate = [
                                                {
                                                    day: 'sun',
                                                    chats: totalMessagesSentThisWeek[0].chats
                                                },
                                                {
                                                    day: 'mon',
                                                    chats: totalMessagesSentThisWeek[1].chats
                                                },
                                                {
                                                    day: 'tue',
                                                    chats: totalMessagesSentThisWeek[2].chats
                                                },
                                                {
                                                    day: 'wed',
                                                    chats: totalMessagesSentThisWeek[3].chats
                                                },
                                                {
                                                    day: 'thu',
                                                    chats: totalMessagesSentThisWeek[4].chats
                                                },
                                                {
                                                    day: 'fri',
                                                    chats: totalMessagesSentThisWeek[5].chats
                                                },
                                                {
                                                    day: 'sat',
                                                    chats: totalMessagesSentThisWeek[6].chats + 1
                                                },
                                                {
                                                    total: totalMessagesSentThisWeek[7].total + 1
                                                }
                                            ]
                                            break;
                                    }

                                    const media = new MessageMedia(message.substring(message.indexOf(':') + 1, message.indexOf(';')), message.substring(message.indexOf(',') + 1))
                                    clientCopy.sendMessage(clientNumber, media)

                                    const chatUpdates = {
                                        _chatMessages: [...existingChat._chatMessages, {
                                            type: 'image',
                                            mimetype: message.substring(message.indexOf(':') + 1, message.indexOf(';')),
                                            data: message.substring(message.indexOf(',') + 1),
                                            caption: username,
                                            from: "seller"
                                        }]
                                    }
                                    const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                    if (chatUpdationErr) return callback(chatUpdationErr)

                                    var chatDetails;
                                    var ownChats = user._wpChats
                                    var chatId = JSON.stringify(updatedChat._id)
                                    for (let index = 0; index < ownChats.length; index++) {
                                        const element = ownChats[index];
                                        if (`"${element.chatId}"` === chatId) {
                                            chatDetails = ownChats.splice(index, 1)
                                            break;
                                        }
                                    }
                                    const userUpdates = {
                                        _wpChats: [{
                                            chatName: chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: 'Image',
                                            from: "seller",
                                            chatLabel: updatedChat._chatLabel
                                        }, ...ownChats],
                                        _totalMessagesSentThisWeek: JSON.stringify(chatsUpdate)
                                    }
                                    const { updatedUser, errrrr } = await updateUsers({ id, userUpdates })
                                    if (errrrr) return callback(errrrr);

                                    socket.emit("user_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser })
                                    socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })

                                    if (updatedChat._chatHandlerId !== "" && updatedChat._chatHandlerId !== id) {
                                        const chatHandler = await getUsers({ id: updatedChat._chatHandlerId })
                                        if (chatHandler.error) return callback(chatHandler.error)

                                        var chatDetails;
                                        var ownChats4 = chatHandler.user._wpChats
                                        var chatId = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats4.length; index++) {
                                            const element = chatHandler.user._wpChats[index];
                                            if (`"${element.chatId}"` === chatId) {
                                                chatDetails = ownChats4.splice(index, 1)
                                                break;
                                            }
                                        }

                                        const orgChat = {
                                            chatName: chatDetails[0].chatName === "" ? "Unknown Contact" : chatDetails[0].chatName,
                                            chatNumber: chatDetails[0].chatNumber === "" ? "Unknown Number" : chatDetails[0].chatNumber,
                                            chatId: chatDetails[0].chatId,
                                            lastMessage: 'Image',
                                            from: 'client',
                                            chatLabel: updatedChat._chatLabel
                                        }
                                        const userUpdates = {
                                            _wpChats: [orgChat, ...ownChats4]
                                        }
                                        const { updatedUser, errrrr } = await updateUsers({ id: chatHandler.user._id, userUpdates })
                                        if (errrrr) return callback(errrrr);

                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser, target: updatedUser._id })
                                        io.to(user._teamId).emit("whatsapp_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedUser._id })
                                    } else if (updatedChat._chatHandlerId === id) {
                                        const teamAdmin = await getUsers({ id: userTeam._teamAdmin })
                                        if (teamAdmin.error) return callback(teamAdmin.error)

                                        var chatDetails2;
                                        var ownChats2 = teamAdmin.user._wpChats
                                        var chatId2 = JSON.stringify(updatedChat._id)
                                        for (let index = 0; index < ownChats2.length; index++) {
                                            const element = ownChats2[index];
                                            if (`"${element.chatId}"` === chatId2) {
                                                chatDetails2 = ownChats2.splice(index, 1)
                                                break;
                                            }
                                        }
                                        const userUpdates2 = {
                                            _wpChats: [{
                                                chatName: chatDetails2[0].chatName,
                                                chatNumber: chatDetails2[0].chatNumber,
                                                chatId: chatDetails2[0].chatId,
                                                lastMessage: 'Image',
                                                from: "seller",
                                                chatLabel: updatedChat._chatLabel
                                            }, ...ownChats2],
                                        }
                                        const updatedTeamAdmin = await updateUsers({ id: teamAdmin.user._id, userUpdates: userUpdates2 })
                                        if (updatedTeamAdmin.errrrr) return callback(updatedTeamAdmin.errrrr);

                                        io.to(user._teamId).emit("member_updated", { password: process.env.CLIENT_SOCKET_PASSWORD, updatedUser: updatedTeamAdmin.updatedUser, target: updatedTeamAdmin.updatedUser._id })
                                        io.to(user._teamId).emit("sent_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: updatedTeamAdmin.updatedUser._id })
                                    }

                                    isChatAlreadyUpdated = true
                                }
                            }

                            return callback()
                        } else {
                            return callback('Whatsapp not authenticated...')
                        }
                    }
                } else {
                    return callback("Access denied...")
                }
            } catch (err) {
                console.log(err)
                return callback('Message not sent...')
            }
        })

        socket.on("add_note", async ({ authToken, password, clientNumber, message, permission }, callback) => {
            try {
                if (password === process.env.SERVER_SOCKET_PASSWORD) {
                    var userTeam;
                    var flag = false;

                    const { id, err } = verifyToken({ authToken })
                    if (err) return callback(err);

                    const { user, error } = await getUsers({ id });
                    if (error) return callback(error);
                    const username = user._name

                    if (user._teamRole !== 'neutral') {
                        var { team, errr } = await getTeam({ teamId: user._teamId });
                        if (errr) return callback(errr);
                        userTeam = team
                        flag = true
                    }

                    if (`"${id}"` !== JSON.stringify(user._id)) return callback("User authentication failed...")

                    if (!flag) {
                        if (user._wpIntegration && user._wpSessionData !== "" && permission) {
                            const checkChat = (chat) => {
                                return chat.chatNumber === clientNumber;
                            }
                            if (user._wpChats.find(checkChat)) {
                                const getChatDetails = (chat) => {
                                    if (chat.chatNumber === clientNumber) {
                                        return chat
                                    }
                                }
                                const foundChat = user._wpChats.find(getChatDetails);

                                const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                if (chatGettingErr) return callback(chatGettingErr)

                                if (existingChat._chatParent !== id && existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')

                                const date = new Date();
                                const day = date.getDay()


                                const chatUpdates = {
                                    _chatMessages: [...existingChat._chatMessages, {
                                        type: 'note',
                                        mimetype: 'note',
                                        data: message,
                                        caption: username,
                                        from: "seller"
                                    }]
                                }
                                const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                if (chatUpdationErr) return callback(chatUpdationErr)

                                socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                            }

                            if (user._wpChats.find(checkChat)) {
                                const getChatDetails = (chat) => {
                                    if (chat.chatNumber === clientNumber) {
                                        return chat
                                    }
                                }
                                const foundChat = user._wpChats.find(getChatDetails);

                                const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                if (chatGettingErr) return callback(chatGettingErr)

                                if (existingChat._chatParentTeam !== user._teamId && existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')

                                const chatUpdates = {
                                    _chatMessages: [...existingChat._chatMessages, {
                                        type: 'note',
                                        mimetype: 'note',
                                        data: message,
                                        caption: username,
                                        from: "seller"
                                    }]
                                }
                                const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                if (chatUpdationErr) return callback(chatUpdationErr)

                                socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                io.to(user._teamId).emit("sent_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: team._teamAdmin })
                            }
                        }
                    } else if (flag) {
                        if (userTeam._teamWpIntegration && userTeam._teamWpSessionData !== "" && permission) {
                            const checkChat = (chat) => {
                                return chat.chatNumber === clientNumber;
                            }
                            if (user._wpChats.find(checkChat)) {
                                const getChatDetails = (chat) => {
                                    if (chat.chatNumber === clientNumber) {
                                        return chat
                                    }
                                }
                                const foundChat = user._wpChats.find(getChatDetails);

                                const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                if (chatGettingErr) return callback(chatGettingErr)

                                if (existingChat._chatParent !== id && existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')

                                const date = new Date();
                                const day = date.getDay()


                                const chatUpdates = {
                                    _chatMessages: [...existingChat._chatMessages, {
                                        type: 'note',
                                        mimetype: 'note',
                                        data: message,
                                        caption: username,
                                        from: "seller"
                                    }]
                                }
                                const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                if (chatUpdationErr) return callback(chatUpdationErr)

                                socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                            }

                            if (user._wpChats.find(checkChat)) {
                                const getChatDetails = (chat) => {
                                    if (chat.chatNumber === clientNumber) {
                                        return chat
                                    }
                                }
                                const foundChat = user._wpChats.find(getChatDetails);

                                const { existingChat, chatGettingErr } = await getChat({ chatId: foundChat.chatId })
                                if (chatGettingErr) return callback(chatGettingErr)

                                if (existingChat._chatParentTeam !== user._teamId && existingChat._chatHandlerId !== id) return callback('Chat authentication failed...')

                                const chatUpdates = {
                                    _chatMessages: [...existingChat._chatMessages, {
                                        type: 'note',
                                        mimetype: 'note',
                                        data: message,
                                        caption: username,
                                        from: "seller"
                                    }]
                                }
                                const { updatedChat, chatUpdationErr } = await updateChat({ chatId: existingChat._id, chatUpdates })
                                if (chatUpdationErr) return callback(chatUpdationErr)

                                socket.emit("sent_message", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat })
                                io.to(user._teamId).emit("sent_message_for_member", { password: process.env.CLIENT_SOCKET_PASSWORD, chat: updatedChat, target: team._teamAdmin })
                            }
                        }
                    }
                } else {
                    return callback("Access denied...")
                }
            } catch (err) {
                console.log(err)
                return callback('Message not sent...')
            }
        })

        socket.on('disconnect', async () => {
            try {
                if (!globalFromInstance) {
                    if (userAuthToken !== "") {
                        const { id, err } = verifyToken({ authToken: userAuthToken })
                        if (!err) {
                            const { user, error } = await getUsers({ id });

                            const checkActiveSession = (browser) => {
                                return browser.sessionId === user._wpSessionData
                            }

                            const getActiveSession = (browser) => {
                                if (browser.sessionId === user._wpSessionData) {
                                    return browser
                                }
                            }
                            if (!error) {
                                if (browser_wp_sessions.find(checkActiveSession)) {
                                    console.log("Closing the previous active session")

                                    const page = browser_wp_sessions.find(getActiveSession)
                                    await page.page.close()

                                    for (let index = 0; index < browser_wp_sessions.length; index++) {
                                        const element = browser_wp_sessions[index];
                                        if (element.sessionId === user._wpSessionData) {
                                            browser_wp_sessions.splice(index, 1)
                                            break;
                                        }
                                    }

                                    if (user._teamRole === 'neutral') {
                                        if (user._wpIntegration && user._wpSessionData !== "") {
                                            if (!browser_wp_sessions.find(checkActiveSession)) {
                                                console.log("Launching browser after adding the array")
                                                const browser = await puppeteer.launch({
                                                    headless: false
                                                });
                                                const page = await browser.newPage();
                                                await page.goto(`http://localhost:1337/home?authToken=${userAuthToken}`);


                                                const userUpdates = {
                                                    _wpInstanceActive: true
                                                }
                                                const { errrrr } = await updateUsers({ id, userUpdates })
                                                if (!errrrr) {
                                                    browser_wp_sessions.push({
                                                        sessionId: user._wpSessionData,
                                                        page
                                                    })
                                                }
                                            } else {
                                                var page2 = browser_wp_sessions.find(getActiveSession)
                                                await page2.page.close()

                                                for (let index = 0; index < browser_wp_sessions.length; index++) {
                                                    const element = browser_wp_sessions[index];
                                                    if (element.sessionId === user._wpSessionData) {
                                                        browser_wp_sessions.splice(index, 1)
                                                        break;
                                                    }
                                                }

                                                console.log("Launching browser after removing the array")

                                                const browser = await puppeteer.launch({
                                                    headless: false
                                                });
                                                const page = await browser.newPage();
                                                await page.goto(`http://localhost:1337/home?authToken=${userAuthToken}`);

                                                const userUpdates = {
                                                    _wpInstanceActive: true
                                                }
                                                const { errrrr } = await updateUsers({ id, userUpdates })
                                                if (!errrrr) {
                                                    browser_wp_sessions.push({
                                                        sessionId: user._wpSessionData,
                                                        page
                                                    })
                                                }

                                            }
                                        }
                                    } else if (user._teamRole === 'admin') {
                                        var { team, errr } = await getTeam({ teamId: user._teamId });
                                        if (!errr) {
                                            if (user._wpIntegration && user._wpSessionData !== "" && team._teamWpIntegration && team._teamWpSessionData !== "") {
                                                if (!browser_wp_sessions.find(checkActiveSession)) {
                                                    console.log("Launching browser after adding the array")
                                                    const browser = await puppeteer.launch({
                                                        headless: false
                                                    });
                                                    const page = await browser.newPage();
                                                    await page.goto(`http://localhost:1337/home?authToken=${userAuthToken}`);


                                                    const userUpdates = {
                                                        _wpInstanceActive: true
                                                    }
                                                    const { errrrr } = await updateUsers({ id, userUpdates })

                                                    const teamUpdates = {
                                                        _teamWpInstanceActive: true
                                                    }
                                                    const { errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })

                                                    if (!errrrr && !errrr) {
                                                        browser_wp_sessions.push({
                                                            sessionId: user._wpSessionData,
                                                            page
                                                        })
                                                    }
                                                } else {
                                                    var page2 = browser_wp_sessions.find(getActiveSession)
                                                    await page2.page.close()

                                                    for (let index = 0; index < browser_wp_sessions.length; index++) {
                                                        const element = browser_wp_sessions[index];
                                                        if (element.sessionId === user._wpSessionData) {
                                                            browser_wp_sessions.splice(index, 1)
                                                            break;
                                                        }
                                                    }

                                                    console.log("Launching browser after removing the array")

                                                    const browser = await puppeteer.launch({
                                                        headless: false
                                                    });
                                                    const page = await browser.newPage();
                                                    await page.goto(`http://localhost:1337/home?authToken=${userAuthToken}`);

                                                    const userUpdates = {
                                                        _wpInstanceActive: true
                                                    }
                                                    const { errrrr } = await updateUsers({ id, userUpdates })

                                                    const teamUpdates = {
                                                        _teamWpInstanceActive: true
                                                    }
                                                    const { errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })

                                                    if (!errrrr && !errrr) {
                                                        browser_wp_sessions.push({
                                                            sessionId: user._wpSessionData,
                                                            page
                                                        })
                                                    }

                                                }
                                            }
                                        }
                                    } else if (user._teamRole === 'seller') {
                                        var { team, errr } = await getTeam({ teamId: user._teamId });

                                        if (!errr) {
                                            if (user._wpIntegration && user._wpSessionData !== "" && team._teamWpIntegration && team._teamWpSessionData !== "") {
                                                if (!browser_wp_sessions.find(checkActiveSession)) {
                                                    console.log("Launching browser after adding the array")

                                                    const page = await browser.newPage();
                                                    await page.goto(`http://localhost:1337/home?authToken=${team._teamAdminAuthToken}`);


                                                    const userUpdates = {
                                                        _wpInstanceActive: true
                                                    }
                                                    const { errrrr } = await updateUsers({ id: team._teamAdmin, userUpdates })

                                                    const teamUpdates = {
                                                        _teamWpInstanceActive: true
                                                    }
                                                    const { errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })

                                                    if (!errrrr && !errrr) {
                                                        browser_wp_sessions.push({
                                                            sessionId: user._wpSessionData,
                                                            page
                                                        })
                                                    }
                                                } else {
                                                    var page2 = browser_wp_sessions.find(getActiveSession)
                                                    await page2.page.close()

                                                    for (let index = 0; index < browser_wp_sessions.length; index++) {
                                                        const element = browser_wp_sessions[index];
                                                        if (element.sessionId === user._wpSessionData) {
                                                            browser_wp_sessions.splice(index, 1)
                                                            break;
                                                        }
                                                    }

                                                    console.log("Launching browser after removing the array")

                                                    const page = await browser.newPage();
                                                    await page.goto(`http://localhost:1337/home?authToken=${team._teamAdminAuthToken}`);

                                                    const userUpdates = {
                                                        _wpInstanceActive: true
                                                    }
                                                    const { errrrr } = await updateUsers({ id: team._teamAdmin, userUpdates })

                                                    const teamUpdates = {
                                                        _teamWpInstanceActive: true
                                                    }
                                                    const { errrr } = await updateTeam({ teamId: user._teamId, teamUpdates })

                                                    if (!errrrr && !errrr) {
                                                        browser_wp_sessions.push({
                                                            sessionId: user._wpSessionData,
                                                            page
                                                        })
                                                    }

                                                }
                                            }
                                        }
                                    }
                                } else {
                                    console.log('Launching the whatsapp instance')
                                    if (user._wpIntegration && user._wpSessionData !== "") {
                                        if (!browser_wp_sessions.find(checkActiveSession)) {
                                            console.log("Launching the whatsapp instance after registering in the ledger")

                                            const browser = await puppeteer.launch({
                                                headless: false
                                            });
                                            const page = await browser.newPage();
                                            await page.goto(`http://localhost:1337/home?authToken=${userAuthToken}`);


                                            const userUpdates = {
                                                _wpInstanceActive: true
                                            }
                                            const { errrrr } = await updateUsers({ id, userUpdates })
                                            if (!errrrr) {
                                                browser_wp_sessions.push({
                                                    sessionId: user._wpSessionData,
                                                    page
                                                })
                                            }
                                        } else {
                                            console.log("Launching the whatsapp instance after destroying the last instance")

                                            for (let index = 0; index < browser_wp_sessions.length; index++) {
                                                const element = browser_wp_sessions[index];
                                                if (element.sessionId === user._wpSessionData) {
                                                    browser_wp_sessions.splice(index, 1)
                                                    break;
                                                }
                                            }

                                            const browser = await puppeteer.launch({
                                                headless: false
                                            });
                                            const page = await browser.newPage();
                                            await page.goto(`http://localhost:1337/home?authToken=${userAuthToken}`);


                                            const userUpdates = {
                                                _wpInstanceActive: true
                                            }
                                            const { errrrr } = await updateUsers({ id, userUpdates })
                                            if (!errrrr) {
                                                browser_wp_sessions.push({
                                                    sessionId: user._wpSessionData,
                                                    page
                                                })
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (err) {
            }
        })
    })

    server.listen(port, () => {
        console.log("X--- Saleshub socket server succesfully running ---X");
        console.log(`X--- Saleshub socket server connection key: ${connection_string} ---X`);
    });

    // Instant Chat server codebase completed
} catch (error) {
    console.log("Some error occured in server main branch: ", error)
}