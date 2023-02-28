const users = require("../db/models/user-model")
const encrypter = require("../lib/encryption/encrypter")

const addUsers = async ({ memberName, memberEmail, memberPassword, teamId }) => {
    try {
        const newUser = await users.create({
            _name: `${memberName} `,
            _email: memberEmail,
            _password: await encrypter(memberPassword),
            _teamId: teamId,
            _teamRole: 'seller'
        })

        if (newUser) {
            return {
                newUser
            }
        } else {
            return {
                errrror: "Member adding thread failed..."
            }
        }
    } catch (err) {
        console.log(err)
        return {
            errrror: "Member adding thread denied..."
        }
    }
}

const getUsers = async ({ id }) => {
    try {
        const user = await users.findById(id).select("-_password");
        if (!user) {
            return {
                error: 'User fetching thread failed...'
            }
        } else {
            return {
                user
            }
        }
    } catch (err) {
        return {
            error: 'User fetching thread denied...'
        }
    }
}

const updateUsers = async ({ id, userUpdates }) => {
    try {
        const user = await users.findByIdAndUpdate(id, userUpdates)
        const updatedUser = await users.findById(id)

        if (!updatedUser) {
            return {
                errrrr: 'User upadation thread failed...'
            }
        } else {
            return {
                updatedUser
            }
        }
    } catch (err) {
        return {
            errrrr: 'User updation thread denied...'
        }
    }
}

const deleteUsers = async ({ id }) => {
    try {
        const deletedUser = await users.findByIdAndDelete(id);

        if (!deletedUser) {
            return {
                error: 'User deletion thread failed...'
            }
        } else {
            return {
                deletedUser
            }
        }
    } catch (err) {
        return {
            error: 'User deletion thread failed...'
        }
    }
}

module.exports = {
    addUsers,
    getUsers,
    updateUsers,
    deleteUsers
}