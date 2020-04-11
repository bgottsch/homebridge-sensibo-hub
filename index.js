'use strict';

const dynamic = true;

const SensiboPlatformModule = require('./lib/platform');
const SensiboPlatform = SensiboPlatformModule.SensiboPlatform;

module.exports = function (homebridge) {
	SensiboPlatformModule.setHomebridge(homebridge);
	homebridge.registerPlatform('homebridge-sensibo', 'Sensibo', SensiboPlatform, dynamic);
};