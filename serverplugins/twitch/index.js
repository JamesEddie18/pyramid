const channelUtils = require("../../server/util/channels");
const stringUtils = require("../../server/util/strings");

const emoteParsing = require("./emoteParsing");
const externalEmotes = require("./externalEmotes");
const groupChats = require("./groupChats");
const twitchApiData = require("./twitchApiData");
const users = require("./users");
const util = require("./util");

const EMOTE_RELOAD_INTERVAL_MS = 3600000;

var log = console.log;
//var warn = console.warn;

module.exports = function(main) {

	log = main.log;
	//warn = main.warn;

	// Utility

	const enabledGlobalEmoteTypes = function() {
		let appConfig = main.appConfig();
		return util.getEnabledExternalEmoticonTypes(
			appConfig.configValue("enableFfzEmoticons") &&
			appConfig.configValue("enableFfzGlobalEmoticons"),
			appConfig.configValue("enableBttvEmoticons") &&
			appConfig.configValue("enableBttvGlobalEmoticons")
		);
	};

	const enabledChannelEmoteTypes = function() {
		let appConfig = main.appConfig();
		return util.getEnabledExternalEmoticonTypes(
			appConfig.configValue("enableFfzEmoticons") &&
			appConfig.configValue("enableFfzChannelEmoticons"),
			appConfig.configValue("enableBttvEmoticons") &&
			appConfig.configValue("enableBttvChannelEmoticons")
		);
	};

	const loadExternalEmotesForClient = function(client) {
		if (util.isTwitch(client)) {
			const globalEnabledTypes = enabledGlobalEmoteTypes();
			externalEmotes.requestExternalGlobalEmoticons(globalEnabledTypes);
		}
	};

	const loadExternalEmotesForChannel = function(channel) {
		const channelEnabledTypes = enabledChannelEmoteTypes();
		log(`Requesting external channel emoticons for ${channel}`);
		externalEmotes.requestExternalChannelEmoticons(
			channel, channelEnabledTypes
		);
	};

	const getExternalEmotesForChannel = function(channel) {
		const globalEnabledTypes = enabledGlobalEmoteTypes();
		const channelEnabledTypes = enabledChannelEmoteTypes();

		let globalEmotes = externalEmotes.getExternalGlobalEmotes();
		let channelEmotes = externalEmotes.getExternalEmotesForChannel(channel);

		// Filter away the non-preferred types

		var g = globalEmotes.filter(
			({ type }) => globalEnabledTypes.indexOf(type) >= 0
		);
		var c = channelEmotes.filter(
			({ type }) => channelEnabledTypes.indexOf(type) >= 0
		);

		// Filter away animated emotes

		if (!main.appConfig().configValue("enableBttvAnimatedEmoticons")) {
			g = g.filter(({ imageType }) => imageType !== "gif");
			c = c.filter(({ imageType }) => imageType !== "gif");
		}

		// Combine and return

		return g.concat(c);
	};

	const updateGroupChatInfo = function(client) {

		if (!util.isTwitch(client)) {
			return;
		}

		let appConfig = main.appConfig();
		let autoJoin = appConfig.configValue("automaticallyJoinTwitchGroupChats");
		let useDisplayNames = appConfig.configValue("enableTwitchChannelDisplayNames");
		let serverName = client.config.name;

		if (autoJoin || useDisplayNames) {
			log("Updating Twitch group chat info...");
			groupChats.requestGroupChatInfo(client, function(error, channels) {
				if (!error && channels) {
					channels.forEach((channel) => {
						let { name, displayName } = channel;
						main.ircConfig().modifyChannelInIrcConfig(
							serverName,
							name,
							{ displayName }
						);
					});

					if (autoJoin) {
						let ircConfigs = main.ircConfig().safeIrcConfigDict();
						let config = ircConfigs[serverName];

						if (config && config.channels) {
							let configChannels = Object.keys(config.channels);
							channels.forEach((channel) => {
								let { name, displayName } = channel;
								if (name && configChannels.indexOf(name) < 0) {
									log(
										"Found and added Twitch group chat: " +
										name
									);
									main.ircControl().addAndJoinChannel(
										serverName,
										name,
										{ displayName }
									);
								}
							});
						}
					}
				}
			});
		}
	};

	const updateUserChatInfo = function(client, username) {
		if (!util.isTwitch(client)) {
			return;
		}

		let appConfig = main.appConfig();
		let useDisplayNames = appConfig.configValue("enableTwitchChannelDisplayNames");
		let serverName = client.config.name;
		let channel = client.config.channels
			.find((channel) => channel.name === username);

		if (useDisplayNames && channel) {
			users.requestTwitchUserInfo(username, function(err, data) {
				if (!err && data && data.display_name) {
					let displayName = stringUtils.clean(data.display_name);
					let channelDisplayName = "#" + displayName;
					if (
						displayName &&
						displayName !== username &&
						channelDisplayName !== channel.displayName
					) {
						main.ircConfig().modifyChannelInIrcConfig(
							serverName,
							username,
							{ displayName: channelDisplayName },
							() => main.ircConfig().loadIrcConfig()
						);
					}
				}
			});
		}
	};

	const updateUserChatInfoForClient = function(client) {
		if (!util.isTwitch(client)) {
			return;
		}

		client.config.channels.forEach((channel) => {
			if (channel.name && channel.name[0] !== "_") {
				updateUserChatInfo(client, channel.name);
			}
		});
	};

	// Events

	const onIrcFrameworkConfig = (data) => {
		let { config } = data;
		if (config && util.isTwitchHostname(config.host)) {
			// Longer message max length than normal IRC networks
			config.message_max_length = 500;
		}
	};

	const onClient = (data) => {
		let { client } = data;
		if (util.isTwitch(client)) {
			client.irc.requestCap([
				"twitch.tv/commands",
				"twitch.tv/membership",
				"twitch.tv/tags"
			]);

			// TODO: Re-evaluate this property on modify server
			main.serverData().setServerData(client.config.name, { isTwitch: true });
			loadExternalEmotesForClient(client);
			updateGroupChatInfo(client);
		}
	};

	const onJoin = function(data) {
		const { client, channel, username } = data;
		if (
			util.isTwitch(client) &&
			username === client.irc.user.nick
		) {
			loadExternalEmotesForChannel(channel);

			let channelName = channelUtils.channelNameFromUri(channel);
			if (channelName && channelName[0] !== "_") {
				updateUserChatInfo(client, channelName);
			}
		}
	};

	const onPart = function(data) {
		const { client, channel, username } = data;
		if (
			util.isTwitch(client) &&
			username === client.irc.user.nick
		) {
			externalEmotes.clearExternalEmotesForChannel(channel);
		}
	};

	const onMessageTags = function(data) {
		var {
			client, channel, message, meUsername, postedLocally,
			serverName, tags, username
		} = data;

		if (util.isTwitch(client)) {
			if (!tags) {
				tags = data.tags = {};
			}

			let channelUserState = twitchApiData.getUserState(channel);

			if (tags.emotes) {
				if (typeof tags.emotes === "string") {
					tags.emotes = emoteParsing.parseEmoticonIndices(tags.emotes);
				}
			}
			else if (
				postedLocally && username === meUsername &&
				channelUserState &&
				twitchApiData.getEmoticonImages(channelUserState["emote-sets"])
			) {
				// We posted this message
				twitchApiData.populateLocallyPostedTags(tags, serverName, channel, message);
			}
			else if ("emotes" in tags) {
				// Type normalization
				tags.emotes = [];
			}

			// Add external emotes
			tags.emotes = emoteParsing.generateEmoticonIndices(
				message,
				getExternalEmotesForChannel(channel),
				tags.emotes || []
			);
		}
	};

	const onCustomMessage = function(data) {
		const { channel, client, message, serverName, time } = data;
		if (message && message.command && util.isTwitch(client)) {
			switch(message.command) {
				case "USERSTATE":
				case "GLOBALUSERSTATE":
					if (message.tags) {
						if (message.command === "GLOBALUSERSTATE") {
							twitchApiData.setGlobalUserState(serverName, message.tags);
						}
						else {
							twitchApiData.setUserState(channel, message.tags);
						}

						if (message.tags["emote-sets"]) {
							twitchApiData.requestEmoticonImagesIfNeeded(
								message.tags["emote-sets"]
							);
						}
					}
					break;
				case "ROOMSTATE":
					if (message.tags) {
						//twitchApiData.setRoomState(channel, message.tags);
						main.channelData().setChannelData(channel, message.tags);
					}
					break;
				case "USERNOTICE": {
					let username = message.tags && message.tags.login;
					let messageText = message.params[1] || "";

					let tagsInfo = {
						client,
						channel,
						message: messageText,
						postedLocally: false,
						serverName,
						tags: message.tags,
						username
					};

					onMessageTags(tagsInfo);

					main.incomingEvents().handleIncomingCustomEvent(
						channel, serverName, username,
						time, "usernotice", messageText, message.tags, null,
						"", true
					);
					break;
				}
				case "CLEARCHAT": {
					let duration = message.tags && message.tags["ban-duration"];
					let reason = message.tags && message.tags["ban-reason"];
					let clearedUsername = message.params[1] || "";

					if (!clearedUsername) {
						// No user
						break;
					}

					let announcement = duration && duration > 0
						? `has been timed out for ${duration} ` +
							stringUtils.pluralize(duration, "second", "s")
						: "has been banned";

					let line = reason
						? announcement + ": " + reason
						: announcement + ".";

					main.incomingEvents().handleIncomingCustomEvent(
						channel, serverName, clearedUsername,
						time, "clearchat", line, message.tags, null,
						`** ${clearedUsername} ${line}`, true
					);
					break;
				}
			}
		}
	};

	const loadExternalEmotesForAllClients = () => {
		log("Reloading emotes for all clients...");

		const clients = main.ircControl().currentIrcClients();

		if (clients && clients.length) {
			clients.forEach((client) => loadExternalEmotesForClient(client));
		}
	};

	const updateChatInfoForAllClients = function() {
		const clients = main.ircControl().currentIrcClients();

		if (clients && clients.length) {
			clients.forEach((client) => updateGroupChatInfo(client));
			clients.forEach((client) => updateUserChatInfoForClient(client));
		}
	};

	// Reload emotes and group chat data every hour

	setInterval(
		twitchApiData.reloadEmoticonImages,
		EMOTE_RELOAD_INTERVAL_MS
	);

	setInterval(
		loadExternalEmotesForAllClients,
		EMOTE_RELOAD_INTERVAL_MS
	);

	setInterval(
		updateChatInfoForAllClients,
		EMOTE_RELOAD_INTERVAL_MS
	);

	// React to external emote settings changes

	setTimeout(function() {
		main.appConfig().addConfigValueChangeHandler(
			[
				"enableFfzEmoticons",
				"enableFfzGlobalEmoticons",
				"enableFfzChannelEmoticons",
				"enableBttvEmoticons",
				"enableBttvGlobalEmoticons",
				"enableBttvAnimatedEmoticons",
				"enableBttvPersonalEmoticons"
			],
			loadExternalEmotesForAllClients
		);
	}, 10000);

	// Events API

	return {
		onClient,
		onCustomMessage,
		onIrcFrameworkConfig,
		onJoin,
		onMessageTags,
		onPart
	};
};
