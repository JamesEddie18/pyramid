import * as actionTypes from "../actionTypes";

const ircConfigsInitialState = {};

export default function (state = ircConfigsInitialState, action) {

	switch (action.type) {
		case actionTypes.ircConfigs.UPDATE:
			return {
				...state,
				...action.data
			};
	}

	return state;
}
