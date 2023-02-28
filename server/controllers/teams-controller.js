const teams = require("../db/models/team-model")
const encrypter = require("../lib/encryption/encrypter")


const addTeam = async ({ teamName, teamMembers, teamPassword, id }) => {
    try {
        let newTeam = await teams.create({
            _teamName: teamName,
            _teamAdmin: id,
            _teamPassword: await encrypter(teamPassword),
            _teamMembers: teamMembers
        })

        if (newTeam) {
            return {
                newTeam
            }
        } else {
            return {
                errr: 'Team registration thread failed...'
            }
        }
    } catch (errr) {
        return {
            errr: 'Team registration thread denied...'
        }
    }
}

const getTeam = async ({ teamId }) => {
    try {
        let team = await teams.findById(teamId).select("-_teamPassword")

        if (team) {
            return {
                team
            }
        } else {
            return {
                errr: 'Team fetching thread failed...'
            }
        }
    } catch (errr) {
        return {
            errr: 'Team fetching thread denied...'
        }
    }
}

const getTeamPassword = async ({ teamId }) => {
    try {
        let team = await teams.findById(teamId)

        if (team) {
            return {
                team
            }
        } else {
            return {
                errr: 'Team fetching thread failed...'
            }
        }
    } catch (errr) {
        return {
            errr: 'Team fetching thread denied...'
        }
    }
}

const updateTeam = async ({ teamId, teamUpdates }) => {
    try {
        let team = await teams.findByIdAndUpdate(teamId, teamUpdates);
        const updatedTeam = await teams.findById(teamId)

        if (updatedTeam) {
            return {
                updatedTeam
            }
        } else {
            return {
                errrr: 'Team updation thread failed...'
            }
        }
    } catch (errr) {
        return {
            errrr: 'Team updation thread denied...'
        }
    }
}

const deleteTeam = async ({ teamId }) => {
    try {
        let deletedTeam = await teams.findByIdAndDelete(teamId);

        if (deletedTeam) {
            return {
                deletedTeam
            }
        } else {
            return {
                errr: 'Team deletion thread failed...'
            }
        }
    } catch (errr) {
        return {
            errr: 'Team deletion thread denied...'
        }
    }
}

module.exports = {
    addTeam,
    getTeam,
    getTeamPassword,
    updateTeam,
    deleteTeam
}
