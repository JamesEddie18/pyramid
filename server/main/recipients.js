const _ = require("lodash");

const constants = require("../constants");

module.exports = function(io) {

	var channelRecipients = {};
	var userRecipients = {};
	var serverRecipients = {};

	var categoryRecipients = {
		highlights: [], allfriends: [], system: []
	};

	const addRecipient = function(list, targetName, socket) {
		if (!list[targetName]) {
			list[targetName] = [];
		}
		if (list[targetName].indexOf(socket) < 0) {
			list[targetName].push(socket);
		}
	};

	const removeRecipient = function(list, targetName, socket) {
		if (list[targetName] && list[targetName].indexOf(socket) >= 0){
			_.remove(list[targetName], (r) => r === socket);
		}
	};

	const addChannelRecipient = function(channel, socket) {
		addRecipient(channelRecipients, channel, socket);
	};

	const removeChannelRecipient = function(channel, socket) {
		removeRecipient(channelRecipients, channel, socket);
	};

	const addUserRecipient = function(username, socket) {
		addRecipient(userRecipients, username, socket);
	};

	const removeUserRecipient = function(username, socket) {
		removeRecipient(userRecipients, username, socket);
	};

	const addCategoryRecipient = function(categoryName, socket) {
		if (constants.SUPPORTED_CATEGORY_NAMES.indexOf(categoryName) >= 0) {
			addRecipient(categoryRecipients, categoryName, socket);
		}
	};

	const removeCategoryRecipient = function(categoryName, socket) {
		if (constants.SUPPORTED_CATEGORY_NAMES.indexOf(categoryName) >= 0) {
			removeRecipient(categoryRecipients, categoryName, socket);
		}
	};

	const addServerRecipient = function(serverName, socket) {
		addRecipient(serverRecipients, serverName, socket);
	};

	const removeServerRecipient = function(serverName, socket) {
		removeRecipient(serverRecipients, serverName, socket);
	};

	const removeRecipientEverywhere = function(socket) {
		_.forOwn(channelRecipients, (list, channel) => {
			removeChannelRecipient(channel, socket);
		});
		_.forOwn(userRecipients, (list, username) => {
			removeUserRecipient(username, socket);
		});
		_.forOwn(categoryRecipients, (list, categoryName) => {
			removeCategoryRecipient(categoryName, socket);
		});
		_.forOwn(serverRecipients, (list, serverName) => {
			removeServerRecipient(serverName, socket);
		});
	};

	const emitToUserRecipients = function(username, msg) {
		if (io) {
			io.emitListEventToRecipients(
				userRecipients[username],
				constants.PAGE_TYPES.USER,
				username,
				msg
			);
		}
	};

	const emitToCategoryRecipients = function(categoryName, msg) {
		if (io) {
			io.emitListEventToRecipients(
				categoryRecipients[categoryName],
				constants.PAGE_TYPES.CATEGORY,
				categoryName,
				msg
			);
		}
	};

	const emitCategoryCacheToRecipients = function(categoryName) {
		if (io) {
			io.emitCategoryCacheToRecipients(
				categoryRecipients[categoryName], categoryName
			);
		}
	};

	const emitToServerRecipients = function(serverName, msg) {
		if (io) {
			io.emitListEventToRecipients(
				serverRecipients[serverName],
				constants.PAGE_TYPES.SERVER,
				serverName,
				msg
			);
		}
	};

	return {
		addCategoryRecipient,
		addChannelRecipient,
		addRecipient,
		addServerRecipient,
		addUserRecipient,
		emitCategoryCacheToRecipients,
		emitToCategoryRecipients,
		emitToServerRecipients,
		emitToUserRecipients,
		getChannelRecipients: (channel) => channelRecipients[channel],
		getServerRecipients: (serverName) => serverRecipients[serverName],
		getUserRecipients: (username) => userRecipients[username],
		removeCategoryRecipient,
		removeChannelRecipient,
		removeRecipient,
		removeRecipientEverywhere,
		removeServerRecipient,
		removeUserRecipient
	};
};
