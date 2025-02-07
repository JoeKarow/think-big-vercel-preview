import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import NextAuth, { NextAuthOptions, unstable_getServerSession } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import DiscordProvider from 'next-auth/providers/discord'
import { prisma } from '~/lib'
import axios from 'axios'
import type { User, Account } from 'next-auth'
import type { APIGuild } from 'discord-api-types/v10'

// import { PrismaClient } from '@prisma/client'
// const prisma = new PrismaClient()
/**
 * It checks if the user is a member of the server
 * @param {Account} account - Account - This is the account object that is returned from the login
 * function.
 * @returns A boolean value
 */
const isServerMember = async (account: Account) => {
	const guildId = '735923219315425401'

	const { data } = await axios.get(
		'https://discord.com/api/v10/users/@me/guilds',
		{
			headers: {
				Authorization: `Bearer ${account.access_token}`,
			},
		}
	)
	if (
		data.some((guild: APIGuild) => {
			if (guild.id === guildId) return true
		})
	) {
		return true
	}
	return false
}

/**
 * It updates the user's serverMember field to the value of the isServerMember parameter
 * @param {User} user - User - The user object that we're updating
 * @param {boolean} isServerMember - boolean - This is a boolean that determines whether the user is a
 * server member or not.
 */
const updateServerMember = async (user: User, isServerMember: boolean) => {
	const { id } = user
	await prisma.user.update({
		where: {
			id,
		},
		data: {
			serverMember: isServerMember,
		},
	})
}

/**
 * It generates a random string of random length
 * @returns A string of random characters.
 */
const generateRandomString = () => {
	let randomString = ''
	const randomNumber = Math.floor(Math.random() * 10)

	for (let i = 0; i < 20 + randomNumber; i++) {
		randomString += String.fromCharCode(33 + Math.floor(Math.random() * 94))
	}

	return randomString
}

const authOptions: NextAuthOptions = {
	providers: [
		DiscordProvider({
			clientId: process.env.DISCORD_CLIENT_ID,
			clientSecret: process.env.DISCORD_CLIENT_SECRET,
			authorization: {
				url: 'https://discord.com/api/oauth2/authorize',
				params: {
					scope: 'identify email guilds guilds.members.read',
					state: generateRandomString(),
					display: 'popup',
				},
			},
			checks: ['pkce', 'state'],
			// profile(profile) {
			// 	if (profile.avatar === null) {
			// 		const defaultAvatarNumber = parseInt(profile.discriminator) % 5
			// 		profile.image_url = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`
			// 	} else {
			// 		const format = profile.avatar.startsWith('a_') ? 'gif' : 'png'
			// 		profile.image_url = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`
			// 	}
			// 	return {
			// 		id: profile.id,
			// 		name: `${profile.username}#${profile.discriminator}`,
			// 		email: profile.email,
			// 		image: profile.image_url,
			// 	}
			// },
		}),
	],
	callbacks: {
		async signIn({ user, account }) {
			// Is the account disabled? Get out of here!
			if (user.userDisabled) return false
			// 100Devs Discord server member? proceed!
			if (user.serverMember) return true
			// check to see if user is a member of the discord server & update status if they are
			const serverMemberStatus = await isServerMember(account)
			if (serverMemberStatus) {
				updateServerMember(user, serverMemberStatus)
				return true
			}
			// nope, get out.
			return false
		},
		async session({ session, user }) {
			session.user.id = user.id
			session.user.role = user.role
			session.user.name = user.name
			return session
		},
	},
	pages: {
		newUser: '/auth/newuser',
	},
	adapter: PrismaAdapter(prisma),
	secret: process.env.SECRET,
}

/**
 * It gets the session from the server
 * @param {NextApiRequest} req - NextApiRequest - The request object from Next.js
 * @param {NextApiResponse} res - NextApiResponse - The response object from Next.js
 * @returns The session object
 */
export const getServerSession = async (
	req: NextApiRequest,
	res: NextApiResponse
) => {
	const session = await unstable_getServerSession(req, res, authOptions)
	return session
}

/**
 * It takes a request and response object, passes them to NextAuth, and returns the result
 * @param req - The request object from Next.js
 * @param res - The response object.
 */
const authHandler: NextApiHandler = (req, res) =>
	NextAuth(req, res, authOptions)
export default authHandler
