import actions from "../actions";
import store from "../store";
import debounce from "lodash/debounce";

import { CACHE_LINES, RELATIONSHIP_NONE } from "../constants";

var io;
var socket;

export function requestParticipation(channelUrl) {
	if (socket) {
		socket.emit("requestChannelParticipation", channelUrl);
	}

	// TODO: user, and unlist
}

export function sendMessage(channelUrl, message) {
	if (socket) {
		const data = {
			channel: channelUrl,
			message
		};

		console.log("Sending message:", data);
		socket.emit("sendMessage", data);

		// TODO: Actually authorize
	}
}

export function cacheMessage(cache, msg) {
	// Add it, or them
	if (msg) {
		if (msg instanceof Array) {
			cache = cache.concat(msg);
		} else {
			cache = [ ...cache, msg ];
		}
	}

	// And make sure we only have the maximum amount
	if (cache.length > CACHE_LINES) {
		if (cache.length === CACHE_LINES + 1) {
			cache = cache.slice(1);
		} else {
			cache = cache.slice(cache.length - CACHE_LINES);
		}
	}

	return cache;
}

var updateLastSeenChannel = (channel, username, time) => {
	store.dispatch(actions.lastSeenChannels.update({
		[channel]: { username, time }
	}));
};

updateLastSeenChannel = debounce(updateLastSeenChannel, 150);

export function initializeIo() {
	if (window.io) {
		io = window.io;
		socket = io();

		socket.on("msg", (details) => {
			const { channel, channelName, time, relationship, username } = details;

			updateLastSeenChannel(channel, username, time);

			store.dispatch(actions.channelCaches.append({
				channel,
				message: details
			}));

			if (relationship === RELATIONSHIP_NONE) {
				return;
			}

			// DEBUG
			console.log("msg", details);
			console.log(
				"%c" + details.username + " in " + details.channel + ": %c" +
				details.message, "font-size: 24px; font-weight: bold", "font-size: 24px"
			);

			store.dispatch(actions.lastSeenUsers.update({
				[username]: { channel, channelName, time }
			}));

			store.dispatch(actions.userCaches.append({
				username,
				message: details
			}));
		});

		socket.on("channelCache", (details) => {
			console.log("Received channel cache!", details);
			if (details && details.channelUri && details.cache) {
				store.dispatch(actions.channelCaches.update({
					[details.channelUri]: details.cache
				}));
			}
		});

		socket.on("userCache", (details) => {
			console.log("Received user cache!", details);
			if (details && details.username && details.cache) {
				store.dispatch(actions.userCaches.update({
					[details.username]: details.cache
				}));
			}
		});

		window.socket = socket; // TEMP DANBAD
	}
};
