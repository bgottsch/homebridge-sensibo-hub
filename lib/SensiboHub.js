"use strict";

const request = require("request-promise");
const xml2js  = require("xml2js");
const jsonDiff  = require("json-diff");

var Accessory, Service, Characteristic, UUIDGen;


// Pods
const PodSky = require("./pods/sky.js");


// Config
const packageConfig = require("../package.json");


module.exports = function(homebridge) {

	Accessory = homebridge.platformAccessory;
	Service = homebridge.hap.Service;
	UUIDGen = homebridge.hap.uuid;
	Characteristic = homebridge.hap.Characteristic;

	return SensiboHub;
};


function SensiboHub(log, config, api) {

	var that = this;

	this.log = log;
	this.config = config;
	this.accessories = [];

	this.log.info("v%s", packageConfig.version);

	try {
		this.config = {
			platform: config["platform"] || "sensibo-hub",
    		name: config["name"] || "sensibo-hub",
			api_key: config["api_key"],
			locations: config["locations"] || [],
			refresh_interval: config["refresh_interval"] || 30000,
			enable_fanDry: config["enable_fanDry"] || false
		}
	}catch{
		this.log.warn("Disabling plugin, config not found!");
		this.disabled = true;
		return;
	}

	if (this.config.api_key == "") {
		this.disabled = true;
		this.log.warn("Empty API Key!");
		return;
	}

	if (api) {
		this.api = api;
		this.api.on("didFinishLaunching", function() {

			// Get pods and start refresh cycle
			that.getPods();
			setInterval(function(){ 
				that.getPods(); 
			}, that.config.refresh_interval);

			that.log.info("Startup complete!");
		});
	}
}


SensiboHub.prototype.configureAccessory = function(accessory) {

	var that = this;

	var _accessory;

	switch (accessory.context.info["model"]) {

		case "sky":
			_accessory = new PodSky(this, accessory);
			break;

		default:
			_accessory = null;
	}

	if (_accessory != null) {
		_accessory.accessory.reachable = false;
		this.accessories.push(_accessory);
		this.log.debug("Added pod from cache (%s, %s, %s)", _accessory.accessory.displayName, _accessory.accessory.context.info["id"], _accessory.accessory.context.info["model"]);
	}else{
		this.log.warn("Accessory from cache returned null (%s, %s, %s)", accessory.displayName, accessory.context.context.info["id"], _accessory.accessory.context.info["model"]);
		this.removeAccessory(accessory);
	}

}


SensiboHub.prototype.configurationRequestHandler = function(context, request, callback) {
	this.log.debug("Configuration request handler not implemented!");
	return;
}


SensiboHub.prototype.getPods = function() {
	
	var that = this;

	var url = "https://home.sensibo.com/api/v2/users/me/pods?fields=*&apiKey=" + this.config.api_key;
	request.get(url)
	.then(function (parsedBody) {

		var pods = JSON.parse(parsedBody)["result"];

		if (pods == null || pods.length == 0) {
			that.log.error("No senisbo devices found on Sensibo server! Please check your API key or devices.");
			that.accessories.forEach(function(cachedAccessory){
				that.removeAccessory(_accessory.accessory);
			});
			return;
		}

		var to_remove = [];

		// Remove and update based on API result
		that.accessories.forEach(function(_accessory){

			var should_remove = true;
			var should_update = false;
			
			pods.forEach(function(pod) {

				var podInfo = that.generateInfo(pod);

				if (_accessory.accessory.context.info["id"] == podInfo["id"]){

					should_remove = false;

					var diff = jsonDiff.diffString(_accessory.accessory.context.info, podInfo);
					if (diff.length > 0) {
						should_update = true;
					}
				}
			});

			if (should_remove) {
				to_remove.push(_accessory);
				that.log.info("Removing pod not found on API (%s, %s, %s)", _accessory.accessory.displayName, _accessory.accessory.context.info["id"], _accessory.accessory.context.info["model"]);
			}
		
			if (should_update) {
				to_remove.push(_accessory);
				that.log.info("Removing pod, new capabilities found (%s, %s, %s)", _accessory.accessory.displayName, _accessory.accessory.context.info["id"], _accessory.accessory.context.info["model"]);
			}
			
		});

		to_remove.forEach(function(_accessory) {
			that.removeAccessory(_accessory.accessory);
		});


		// Add pods from result
		pods.forEach(function(pod){

			var podInfo = that.generateInfo(pod);

			var duplicate = false;
			that.accessories.forEach(function(_accessory){
				if (_accessory.accessory.context.info["id"] == podInfo["id"]){
					duplicate = true;
				}
			});

			if (!duplicate) {
				that.addAccessory(pod, "device");
				that.log.info("Added pod (%s, %s, %s)", podInfo["name"], podInfo["id"], podInfo["model"]);
			}else{
				that.log.debug("Ignoring cached pod (%s, %s, %s)", podInfo["name"], podInfo["id"], podInfo["model"]);
			}

			// Update state and reachability
			that.accessories.forEach(function(_accessory){
				if (_accessory.accessory.context.info["id"] == podInfo["id"]){
					that.updateAccessoriesReachability(_accessory.accessory, pod["connectionStatus"]["isAlive"]);
					if (!_accessory.blockExternalUpdates) {
						_accessory.accessory.context.state = that.generateState(pod);
						_accessory.updateState();
					}
				}
			});
		});

	})
	.catch(function (err) {
		that.log.debug("Please check your API key or connection, get pods error:\n%s", err);
	});

}


SensiboHub.prototype.addAccessory = function(pod) {
	
	var that = this;

	var podInfo  = that.generateInfo(pod);
	var podState = that.generateState(pod);

	var uuid = UUIDGen.generate(podInfo["name"]);
	var defaultAccessory = new Accessory(podInfo["name"], uuid);

	defaultAccessory.context.info = podInfo;
	defaultAccessory.context.state = podState;

	var newAccessory = null;
	switch (defaultAccessory.context.info["model"]) {

		case "sky":
			newAccessory = new PodSky(this, defaultAccessory);
			break;

		default:
			newAccessory = null;
	}

	if (newAccessory != null) {
		this.accessories.push(newAccessory);
		this.api.registerPlatformAccessories(packageConfig.name, this.config.platform, [newAccessory.accessory]);
		newAccessory.accessory.reachable = false;
		this.log.debug("Registered new accessory (%s, %s, %s)", podInfo["name"], podInfo["id"], podInfo["model"]);
	}else{
		this.log.error("Error adding accessory (%s, %s, %s)", podInfo["name"], podInfo["id"], podInfo["model"]);
	}
	
}


SensiboHub.prototype.removeAccessory = function(accessory) {

	var that = this;

	var index = 0;
	this.accessories.forEach(function(_accessory){
		if (_accessory.accessory.context.info["id"] == accessory.context.info["id"]){
			that.accessories.splice(index, 1);
		}
		index++
	});

	this.api.unregisterPlatformAccessories(packageConfig.name, this.config.platform, [accessory]);
	this.log.debug("Unregisterd accessory (%s, %s, %s)", accessory.displayName, accessory.context.info["id"], accessory.context.info["model"]);
}


SensiboHub.prototype.updateAccessoriesReachability = function(accessory, enabled = true) {
	
	accessory.reachable = enabled;
	this.log.debug("Set reachability: %s (%s, %s, %s)", enabled, accessory.displayName, accessory.context.info["id"], accessory.context.info["model"]);

	if (!enabled) {
		this.log.warn("Accessory unreachable (%s, %s, %s)", accessory.displayName, accessory.context.info["id"], accessory.context.info["model"]);
	}

}


SensiboHub.prototype.generateInfo = function(pod) {

	var model;
	if (pod["productModel"].indexOf("sky") > -1) {
		model = "sky";
	}
	
	switch (model) {

		case "sky":

			var autoMode_supported = pod["remoteCapabilities"]["modes"].hasOwnProperty("auto");
			var heatMode_supported = pod["remoteCapabilities"]["modes"].hasOwnProperty("heat");
			var coolMode_supported = pod["remoteCapabilities"]["modes"].hasOwnProperty("cool");
			var fanMode_supported  = pod["remoteCapabilities"]["modes"].hasOwnProperty("fan");
			var dryMode_supported  = pod["remoteCapabilities"]["modes"].hasOwnProperty("dry");

			if (autoMode_supported && heatMode_supported && coolMode_supported) {

				var podInfo = {
					id: pod["id"],
					name: pod["room"]["name"],
					model: model,
					maxTemp: null,
					minTemp: null,
					fanLevels: null,
					swingSupported: null,
					fanDryModeSupported: null
				};

				var coolMode = pod["remoteCapabilities"]["modes"]["cool"];
				
				// max and min temperatures (HK defaults to degrees C)
				podInfo["maxTemp"] = coolMode["temperatures"]["C"]["values"].sort().reverse()[0];
				podInfo["minTemp"] = coolMode["temperatures"]["C"]["values"].sort()[0];

				// fan levels
				podInfo["fanLevels"] = coolMode["fanLevels"];
				var auto_index = podInfo["fanLevels"].indexOf("auto");
				if (auto_index > -1) {
					podInfo["fanLevels"].splice(auto_index, 1);
				}

				// swing supported
				podInfo["swingSupported"] = false;
				if (coolMode["swing"].length > 0) {
					podInfo["swingSupported"] = true;
				}

				// fan/dry mode supported
				podInfo["fanDryModeSupported"] = (this.config.enable_fanDry && fanMode_supported && dryMode_supported);

				return podInfo;

			}
			break;

	}

	return {};
}


SensiboHub.prototype.generateState = function(pod) {

	var state = {
		on: pod["acState"]["on"],
		fanLevel: pod["acState"]["fanLevel"],
		temperatureUnit: pod["acState"]["temperatureUnit"],
		targetTemperature: pod["acState"]["targetTemperature"],
		mode: pod["acState"]["mode"],
		swing: pod["acState"]["swing"],
		currentTemperature: pod["measurements"]["temperature"],
		currentHumidity: pod["measurements"]["humidity"]
	};
	return state;

}

