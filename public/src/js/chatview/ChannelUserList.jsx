import React, { PureComponent } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import forOwn from "lodash/forOwn";
import without from "lodash/without";
import { List } from "react-virtualized";

import TimedUserItem from "../components/TimedUserItem.jsx";
import { ITEM_LIST_ITEM_HEIGHT } from "../constants";

const USER_SYMBOL_ORDER = ["~", "&", "@", "%", "+"];

class ChannelUserList extends PureComponent {
	// TODO: Change into a wrapper of <UserList />?

	constructor(props) {
		super(props);

		this.renderListItem = this.renderListItem.bind(this);
		this.currentList = [];
	}

	componentWillReceiveProps(newProps) {
		let { userList } = this.props;

		if (userList !== newProps.userList) {
			this.currentList = this.sortedUserList(newProps.userList);
		}
	}

	groupUserList(userList) {
		var output = {};

		forOwn(userList, (data, username) => {
			let { symbol } = data;

			if (!output[symbol]) {
				output[symbol] = [];
			}

			output[symbol].push({ username, ...data });
		});

		forOwn(output, (list) => {
			list.sort(function(a, b) {
				if (a && b) {
					return a.username.toLowerCase()
						.localeCompare(b.username.toLowerCase());
				}
				return -1;
			});
		});

		return output;
	}

	sortedUserList(userList) {
		var output = [];
		const grouped = this.groupUserList(userList);
		const groups = Object.keys(grouped);

		if (!grouped || !groups || !groups.length) {
			return output;
		}

		// Default promoted symbols in order
		const addUsersOfSymbol = (symbol) => {
			if (grouped[symbol]) {
				output = output.concat(grouped[symbol]);
			}
		};
		USER_SYMBOL_ORDER.forEach(addUsersOfSymbol);

		// Unrecognized symbols
		const unrecognizedGroups = without(groups, ...USER_SYMBOL_ORDER.concat([""]));
		if (unrecognizedGroups && unrecognizedGroups.length) {
			unrecognizedGroups.forEach(addUsersOfSymbol);
		}

		// The rest; people without symbol
		addUsersOfSymbol("");

		return output;
	}

	renderListItem(request) {
		let { index, key, style } = request;
		let { channel, lastSeenUsers } = this.props;
		let data = this.currentList[index];

		if (data) {
			let { displayName, username, symbol } = data;
			let lastSeen = lastSeenUsers[username];

			return <TimedUserItem
				contextChannel={channel}
				displayName={displayName}
				lastSeenData={lastSeen}
				skipOld={false}
				symbol={symbol}
				username={username}
				visible={true}
				style={style}
				key={key} />;
		}

		return null;
	}

	render() {
		let userList = this.currentList;

		if (userList) {
			// TODO: Better way of calculating this...
			let height = window.innerHeight - 41 - 72;

			return (
				<div className="channeluserlist itemlist">
					<List
						height={height}
						rowCount={userList.length}
						rowHeight={ITEM_LIST_ITEM_HEIGHT}
						rowRenderer={this.renderListItem}
						width={280} />
				</div>
			);
		}

		return null;
	}
}

ChannelUserList.propTypes = {
	channel: PropTypes.string,
	lastSeenUsers: PropTypes.object,
	userList: PropTypes.object
};

const mapStateToProps = function(state, ownProps) {
	let { channel } = ownProps;
	let { channelUserLists, lastSeenUsers } = state;

	return {
		lastSeenUsers,
		userList: channelUserLists[channel]
	};
};

export default connect(mapStateToProps)(ChannelUserList);
