const ASTRAL_SYMBOLS_REGEX = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

const isTwitch = function(client) {
	if (client && client.config) {
		return /irc\.(chat\.)?twitch\.tv/.test(client.config.hostname);
	}

	return false;
};

const rangesOverlap = function (x1, x2, y1, y2) {
	var low1, low2, high1, high2;
	if (x1 <= y1) {
		low1 = x1;
		low2 = x2;
		high1 = y1;
		high2 = y2;
	}
	else {
		low1 = y1;
		low2 = y2;
		high1 = x1;
		high2 = x2;
	}

	return low1 <= high2 && high1 <= low2;
};

const stringWithoutAstralSymbols = function(str) {
	// Prevent index issues when astral symbols are involved in index-generating routine
	return str.replace(ASTRAL_SYMBOLS_REGEX, "_");
};

const getEnabledExternalEmoticonTypes = function(ffzEnabled, bttvEnabled) {
	const enabledTypes = [];

	if (ffzEnabled) {
		enabledTypes.push("ffz");
	}

	if (bttvEnabled) {
		enabledTypes.push("bttv");
	}

	return enabledTypes;
};

module.exports = {
	getEnabledExternalEmoticonTypes,
	isTwitch,
	rangesOverlap,
	stringWithoutAstralSymbols
};