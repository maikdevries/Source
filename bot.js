const Discord = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'REACTION'] });

const config = require('./config.json');

const welcomeMessage = require('./features/welcomeMessage.js');
const serverLock = require('./features/serverLock.js');
const reactionRole = require('./features/reactionRole.js');
const twitch = require('./features/twitch.js');
const youtube = require('./features/youtube.js');
const streamStatus = require('./features/streamStatus.js');
const commandHandler = require('./features/commandHandler.js');


client.on('ready', async () => {
	await client.user.setUsername(config.username)
		.catch((error) => console.error(`An error occurred when setting the username, ${error}`));

	await client.user.setAvatar('./avatar.png')
		.catch((error) => console.error(`An error occurred when setting the avatar, ${error}`));

	await client.user.setActivity(config.activity, { type: 'PLAYING' })
		.catch((error) => console.error(`An error occurred when setting the default activity, ${error}`));

	await commandHandler.setup();

	// Set an interval to poll the Twitch API repeatedly
	setInterval(() => twitch.fetchStream(client), 60000);

	// Set intervals to poll the YouTube API repeatedly
	setInterval(() => youtube.fetchVideo(client), 600000);
	setInterval(() => youtube.fetchStream(client), 1200000);

	console.log(`${client.user.username} has loaded successfully and is now online!`);
});


// Takes care of the command logic in a separate command handler
client.on('message', (message) => {
	commandHandler.execute(client, message);
});

client.on('messageUpdate', async (ignore, newMessage) => {
	client.emit('message', newMessage);
});


// Manages the 'Currently Livestreaming' role functionality
client.on('presenceUpdate', (oldPresence, newPresence) => {
	streamStatus.setStatus(client, oldPresence, newPresence);
});


// Adds role to user based on reaction added to message
client.on('messageReactionAdd', async (reaction, user) => {
	if (reaction.partial) await reaction.fetch().catch((error) => console.error(`An error occurred fetching the partial reaction message, ${error}`));

	reactionRole.roleAdd(client, reaction, user);
	serverLock.memberUnlock(client, reaction, user);
});

// Removes role from user based on reaction removed from message
client.on('messageReactionRemove', async (reaction, user) => {
	if (reaction.partial) await reaction.fetch().catch((error) => console.error(`An error occurred fetching the partial reaction message, ${error}`));

	reactionRole.roleRemove(client, reaction, user);
});


// Sends out a welcome message when a new user joins the server
client.on('guildMemberAdd', (member) => {
	welcomeMessage.memberAdd(client, member);
	welcomeMessage.memberAddDM(member);
	serverLock.memberLock(client, member);
});

// Sends out a leave message when an user leaves the server
client.on('guildMemberRemove', (member) => {
	welcomeMessage.memberRemove(client, member);
});


client.on('error', (error) => {
	console.error(`An error occurred with Discord, ${error}`);
});

client.login(config.token);


process.on('unhandledRejection', (error) => {
	console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
	client.destroy();
	process.exit();
});
