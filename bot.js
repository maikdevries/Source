const Discord = require('discord.js');
const client = new Discord.Client();

const fs = require('fs');

const config = require('./config.json');
const prefix = config.commandPrefix || '!';

const welcomeMessage = require('./features/welcomeMessage.js');
const reactionRole = require('./features/reactionRole.js');
const twitch = require('./features/twitch.js');
const youtube = require('./features/youtube.js');


// Create a Discord Collection from all the 'command modules' in the 'commands' folder
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}


client.on('ready', async () => {
	if (config.username) {
		await client.user.setUsername(config.username)
			.catch((error) => console.error(`An error occurred when setting the username, ${error}`));
	} else {
		await client.user.setUsername('Lunar')
			.catch((error) => console.error(`An error occurred when setting the username, ${error}`));
	}

	await client.user.setAvatar('./avatar.png')
		.catch((error) => console.error(`An error occurred when setting the avatar, ${error}`));

	if (config.activity) {
		await client.user.setActivity(config.activity, { type: 'PLAYING' })
			.catch((error) => console.error(`An error occurred when setting the default activity, ${error}`));
	} else {
		await client.user.setActivity('with Admin perks', { type: 'PLAYING' })
			.catch((error) => console.error(`An error occurred when setting the default activity, ${error}`));
	}


	// Set an interval to poll all APIs every 60 seconds
	setInterval(() => {
		twitch.fetchStream(client);
		youtube.fetchVideo(client);
	}, 90000);


	console.log(`${client.user.username} has loaded successfully and is now online!`);
});


// Dynamic command handler - Execute 'command module' if the command is part of the 'command Discord Collection'
client.on('message', (message) => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	if (message.channel.type !== 'text') return message.channel.send(`**Sorry**! Unfortunately, I can't help you with that in direct messages.`);

	const args = message.content.slice(prefix.length).split(/ +/);
	const commandName = args.shift().toLowerCase();

	// Looks up the command in the Discord Collection by either name directly or one of its aliases
	const command = client.commands.get(commandName) || client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));
	if (!command) return;

	// If command arguments were expected but not given, return an error message to the user
	if (command.args && !args.length) {
		let reply = `**Oh no**! You didn't provide any arguments for this command to work properly!`;

		if (command.usage) reply += ` The proper usage would be: \`${command.usage}\``;

		return message.channel.send(reply).then((msg) => msg.delete({ timeout: 3500 }));
	}

	try {
		command.execute(message, args);
	} catch (error) {
		console.error(`An error occurred executing one of the commands, ${error}`);
		message.channel.send('**Oops**! Something went terribly wrong! Please try again later.').then((msg) => msg.delete({ timeout: 3500 }));
	}
});


const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

// Emits 'messageReactionAdd' and 'messageReactionRemove' events on non-cached messages
client.on('raw', (event) => {
	if (!Object.prototype.hasOwnProperty.call(events, event.t)) return;

	const { d: data } = event;
	const user = client.users.get(data.user_id);
	const channel = client.channels.get(data.channel_id);

	if (channel.messages.has(data.message_id)) return;

	channel.messages.fetch(data.message_id).then((message) => {
		const emojiKey = data.emoji.id || data.emoji.name;
		const reaction = message.reactions.get(emojiKey) || message.reactions.add(data);

		client.emit(events[event.t], reaction, user);
	});
});

// Adds role to user based on reaction added to message
client.on('messageReactionAdd', (reaction, user) => {
	reactionRole.roleAdd(reaction, user);
});

// Removes role from user based on reaction removed from message
client.on('messageReactionRemove', (reaction, user) => {
	reactionRole.roleRemove(reaction, user);
});


// Sends out a welcome message when a new user joins the server
client.on('guildMemberAdd', (member) => {
	welcomeMessage.memberAdd(member);
});

// Sends out a leave message when an user leaves the server
client.on('guildMemberRemove', (member) => {
	welcomeMessage.memberRemove(member);
});


client.on('error', (error) => {
	console.error(`An error occurred with Discord, ${error}`);
});

client.login(config.token);


process.on('SIGINT', () => {
	client.destroy();
	process.exit();
});
