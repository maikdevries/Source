const https = require('https');
const Discord = require('discord.js');

const config = require('./../config.json');


let streamStatus = false;
let updateInterval;


module.exports = {
	description: 'Interacts with the Twitch API to do various tasks, such as livestream announcements',
	fetchStream
};


// Polls API and checks whether channel is currently streaming
function fetchStream (client) {
	if (!config.twitch.enabled) return;

	const path = `streams?user_login=${config.twitch.username}`;

	callAPI(path).then((streamInfo) => {
		if (!streamInfo.data || !streamInfo.data[0]) {
			streamStatus = false;
			clearInterval(updateInterval);
		}
		else {
			if (streamStatus) return;

			streamStatus = true;

			fetchData(streamInfo).then(([userInfo, gameInfo]) => {
				if (!userInfo.data || !gameInfo.data) streamStatus = false;
				else sendAnnouncement(client, streamInfo, userInfo, gameInfo);
			});
		}
	});
}

// Fetches additional required data to construct embed
async function fetchData (streamInfo) {
	let path = `users?login=${config.twitch.username}`;
	const userInfo = await callAPI(path);

	path = `games?id=${streamInfo.data[0].game_id}`;
	const gameInfo = await callAPI(path);

	return [userInfo, gameInfo];
}

// Constructs a MessageEmbed and sends it to livestream announcements channel
function sendAnnouncement (client, streamInfo, userInfo, gameInfo) {
	const channel = client.channels.find((ch) => ch.id === config.twitch.announcementChannelID);

	if (!channel) return console.error(`Couldn't send Twitch livestream announcement because the announcement channel couldn't be found.`);

	const embed = new Discord.MessageEmbed()
		.setAuthor(`${streamInfo.data[0].user_name} is now LIVE on Twitch!`, userInfo.data[0].profile_image_url)
		.setTitle(streamInfo.data[0].title)
		.setURL(`https://twitch.tv/${streamInfo.data[0].user_name}`)
		.setDescription(`**${streamInfo.data[0].user_name}** is playing **${gameInfo.data[0].name}** with **${streamInfo.data[0].viewer_count}** people watching!\n\n[**Come watch the stream!**](https://twitch.tv/${streamInfo.data[0].user_name})`)
		.setColor('#6441A5')
		.setThumbnail((gameInfo.data[0].box_art_url).replace('{width}', '300').replace('{height}', '400'))
		.setImage((streamInfo.data[0].thumbnail_url).replace('{width}', '1920').replace('{height}', '1080'))
		.setFooter(`Powered by ${client.user.username}`, client.user.avatarURL())
		.setTimestamp(new Date(streamInfo.data[0].started_at));

	return channel.send(config.twitch.announcementMessage, { embed }).then((msg) => update(msg));
}

// Updates the livestream announcement every 3 minutes with current stream statistics
function update (message) {
	updateInterval = setInterval(() => {
		fetchUpdatedData().then(([streamInfo, gameInfo]) => {
			if (!streamInfo.data || !gameInfo.data) return;
			else {
				const editedEmbed = new Discord.MessageEmbed(message.embeds[0])
					.setTitle(streamInfo.data[0].title)
					.setDescription(`**${streamInfo.data[0].user_name}** is playing **${gameInfo.data[0].name}** with **${streamInfo.data[0].viewer_count}** people watching!\n\n[**Come watch the stream!**](https://twitch.tv/${streamInfo.data[0].user_name})`)
					.setThumbnail((gameInfo.data[0].box_art_url).replace('{width}', '300').replace('{height}', '400'));

				return message.edit(config.twitch.announcementMessage, editedEmbed);
			}
		});
	}, 180000);
}

// Fetches required data to be used in update livestream announcement with current stream statistics
async function fetchUpdatedData () {
	let path = `streams?user_login=${config.twitch.username}`;
	const streamInfo = await callAPI(path);

	path = `games?id=${streamInfo.data[0].game_id}`;
	const gameInfo = await callAPI(path);

	return [streamInfo, gameInfo];
}

// Template HTTPS get function that interacts with the Twitch API, wrapped in a Promise
function callAPI (path) {
	return new Promise((resolve) => {

		const options = {
			host: 'api.twitch.tv',
			path: `/helix/${path}`,
			headers: {
				'Client-ID': config.twitch['client-ID']
			}
		};

		https.get(options, (res) => {
			if (res.statusCode !== 200) return;

			const rawData = [];
			res.on('data', (chunk) => rawData.push(chunk));
			res.on('end', () => {
				try {
					resolve(JSON.parse(rawData));
				} catch (error) { console.error(`An error occurred parsing the API response to JSON, ${error}`); }
			});

		}).on('error', (error) => console.error(`Error occurred while polling Twitch API, ${error}`));
	});
}
