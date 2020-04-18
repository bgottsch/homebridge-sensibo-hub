"use strict";

module.exports = function (homebridge) {
	let SensiboHub = require("./lib/SensiboHub")(homebridge);
	homebridge.registerPlatform("homebridge-sensibo-hub", "sensibo-hub", SensiboHub, true);
};