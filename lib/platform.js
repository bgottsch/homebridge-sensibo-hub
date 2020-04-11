'use strict';

var request = require('request-promise'),
	xml2js  = require('xml2js');

const SensiboSkyAccessoryModule = require('./sky');
const SensiboSkyAccessory = SensiboSkyAccessoryModule.SensiboSkyAccessory;

const packageConfig = require('../package.json');


var Accessory, Service, Characteristic, UUIDGen;


function setHomebridge(homebridge) {

	SensiboSkyAccessoryModule.setHomebridge(homebridge);

	Accessory = homebridge.platformAccessory;
	Service = homebridge.hap.Service;
	UUIDGen = homebridge.hap.uuid;
	Characteristic = homebridge.hap.Characteristic;
}


class SensiboPlatform {

	constructor(log, config, api) {

		var that = this;

		if (!config) {
			log.warn("Ignoring Sensibo because it is not configured");
    		this.disabled = true;
    		return;
    	}

    	this.config = {
    		platform: config["platform"] || "Sensibo",
    		name: config["name"] || "Sensibo",
			api_key: config["api_key"] || "",
			refresh_interval: config["refresh_interval"] || 30000
		}

		if (this.config.api_key == '') {
			this.disabled = true;
			log.warn("API Key empty!");
			return;
		}

		this.log = log;
    	this.log.info("version %s", packageConfig.version);
		this.accessories = [];
		this.status = [];

		if (api) {

			this.api = api;

			this.api.on('didFinishLaunching', function() {

				var url = 'https://home.sensibo.com/api/v2/users/me/pods?fields=*&apiKey=' + that.config.api_key;
				request.get(url)
				.then(function (parsedBody) {

					var pods = JSON.parse(parsedBody)['result'];

					if (pods != null && pods.length > 0) {

						that.accessories.forEach(function(cachedAccessory){
							var shouldRemove = true;
							pods.forEach(function(pod){
								if (cachedAccessory.displayName == pod.room.name){
									shouldRemove = false;
								}
								if (cachedAccessory.context.id == pod.id){
									shouldRemove = false;
								}
							});
							if (shouldRemove) {
								that.log("Removing cached accessory not found on server (%s, %s)", cachedAccessory.displayName, cachedAccessory.context.id);
								that.removeAccessory(cachedAccessory.context.id);
							}
						});

						that.accessories.forEach(function(cachedAccessory){
							pods.forEach(function(pod){
								if (cachedAccessory.context.id == pod.id && cachedAccessory.displayName == pod.room.name){
									var equal = true;
									if (JSON.stringify(cachedAccessory.context.info) != JSON.stringify(that.generateInfo(pod))){
										equal = false;
									}
									if (!equal){
										that.log("Updating cached accessory (%s, %s)", cachedAccessory.displayName, cachedAccessory.context.id);
										that.removeAccessory(cachedAccessory.context.id);
										that.addAccessory(pod);
									}
								}
							});
						});

						pods.forEach(function(pod){
							var duplicate = false;
							that.accessories.forEach(function(accessory){
								if (accessory.context.id == pod.id){
									duplicate = true;
									return;
								}
								if (accessory.displayName == pod.room.name){
									duplicate = true;
									return;
								}
							});

							if (!duplicate) {
								if (pod.room.name != null && pod.id != null) {
									that.addAccessory(pod);
								}else{
									that.log.debug("null name or id found!");
								}
							}else{
								that.log("Ignoring cached device (name: %s, id: %s)", pod.room.name, pod.id);
							}
						});

					}else{
						that.log.error("No senisbo devices found on Sensibo server! Please check your API key.");
						that.accessories.forEach(function(cachedAccessory){
							that.removeAccessory(cachedAccessory.context.id);
						});
					}

					setInterval(function(){ that.status_fetch() }, that.config.refresh_interval);
			    })
			    .catch(function (err) {
			        console.log(err);
			    });

			}.bind(this));
		}
	}

	configurationRequestHandler(context, request, callback) {
		return;
	}

	configureAccessory(accessory) {

		var that = this;
		var duplicate = false;

		this.accessories.forEach(function(cachedAccessory){
  			if (cachedAccessory.UUID == accessory.UUID){
  				that.log.error("Configure accessory error: device with UUID %s already exists!", accessory.UUID);
  				duplicate = true;
  				return;
  			}
  			if (cachedAccessory.displayName == accessory.displayName){
  				that.log.error("Configure accessory error: device with name %s already exists!", accessory.displayName);
  				duplicate = true;
  				return;
  			}
  			if (cachedAccessory.context.id == accessory.context.id){
  				that.log.error("Configure accessory error: device with id %s already exists!", accessory.context.id);
  				duplicate = true;
  				return;
  			}
		});

		if (!duplicate) {

			accessory.reachable = true;

			var cachedAccessory = accessory;

			switch (cachedAccessory.context.info.model) {
				case "sky":
					cachedAccessory = new SensiboSkyAccessory(this, accessory).accessory;
					break;
				default:
					cachedAccessory = null;
			}

			if (cachedAccessory != null) {
				this.accessories.push(cachedAccessory);
				that.log("Adding cached device (%s, %s)", accessory.displayName, accessory.context.id);
			}
		}
	}

	addAccessory(pod) {

		var that = this;
		var duplicate = false;

		this.accessories.forEach(function(accessory){
  			if (accessory.context.id == pod.id){
  				that.log.error("Add accessory error: device with ID %s already exists!", pod.id);
  				duplicate = true;
  				return;
  			}
  			if (accessory.displayName == pod.room.name){
  				that.log.error("Add accessory error: device with name %s already exists!", pod.room.name);
  				duplicate = true;
  				return;
  			}
		});

		if (!duplicate) {
			this.log("Adding accessory (%s, %s)", pod.room.name, pod.id);

			var uuid = UUIDGen.generate(pod.room.name);
			var defaultAccessory = new Accessory(pod.room.name, uuid);

			defaultAccessory.context.id = pod.id;
			defaultAccessory.context.info = this.generateInfo(pod);
			defaultAccessory.context.status = this.generateStatus(pod);

			var newAccessory = null;

			switch (defaultAccessory.context.info.model) {
				case "sky":
					newAccessory = new SensiboSkyAccessory(this, defaultAccessory).accessory;
					break;
				default:
					newAccessory = null;
			}

			if (newAccessory != null) {

				newAccessory.reachable = pod['connectionStatus']['isAlive'];

				this.accessories.push(newAccessory);
				this.api.registerPlatformAccessories('homebridge-sensibo', 'Sensibo', [newAccessory]);
			}else{
				this.log.error("Wrong accessory type! (%s, %s)", newAccessory.displayName, newAccessory.context.type);
			}
		}
	}

	updateAccessoriesReachability(id, enabled = true) {

  		var that = this;

  		var accessory;
  		this.accessories.forEach(function(_accessory){
  			if (_accessory.context.id == id){
  				accessory = _accessory;
  				return;
  			}
		});

		if (accessory == null) {
			this.log.error("Could not update reachability of device with ID %s", id);
		}else{
			accessory.updateReachability(enabled);
			if (!enabled) {
				this.log("Accessory unreachable (%s, %s)", accessory.displayName, id);
			}
		}
  	}

  	removeAccessory(id) {

  		var that = this;

		var accessory;
  		this.accessories.forEach(function(_accessory){
  			if (_accessory.context.id == id){
  				accessory = _accessory;
  				return;
  			}
		});

		if (accessory == null) {
			this.log.error("Could not delete device with ID %s", id);
		}else{
			this.log("Removing accessory (%s, %s)", accessory.displayName, id);

			var index = this.accessories.indexOf(accessory);
			if (index > -1) {
				this.accessories.splice(index, 1);
			}

			this.api.unregisterPlatformAccessories('homebridge-sensibo', 'Sensibo', [accessory]);
		}
  	}

	generateInfo(pod){

		var model = 'undefined';
		if (pod['productModel'].indexOf('sky') > -1) {
			model = 'sky';
		}

		var heat_supported = pod['remoteCapabilities']['modes'].hasOwnProperty('heat');
		var heat_max_temp = 0,
			heat_min_temp = 0;
		if (heat_supported) {
			if (pod['remoteCapabilities']['modes']['heat']['temperatures']['F']['isNative']) {
				var count = pod['remoteCapabilities']['modes']['heat']['temperatures']['C']['values'].length;
				heat_max_temp = pod['remoteCapabilities']['modes']['heat']['temperatures']['C']['values'][count - 1];
				heat_min_temp = pod['remoteCapabilities']['modes']['heat']['temperatures']['C']['values'][0];
			}else{
				var count = pod['remoteCapabilities']['modes']['heat']['temperatures']['F']['values'].length;
				heat_max_temp = pod['remoteCapabilities']['modes']['heat']['temperatures']['F']['values'][count - 1];
				heat_min_temp = pod['remoteCapabilities']['modes']['heat']['temperatures']['F']['values'][0];
			}
		}

		var cool_supported = pod['remoteCapabilities']['modes'].hasOwnProperty('cool');
		var cool_max_temp = 0,
		    cool_min_temp = 0;
		if (cool_supported) {
		    if (pod['remoteCapabilities']['modes']['cool']['temperatures']['F']['isNative']) {
		        var count = pod['remoteCapabilities']['modes']['cool']['temperatures']['C']['values'].length;
		        cool_max_temp = pod['remoteCapabilities']['modes']['cool']['temperatures']['C']['values'][count - 1];
		        cool_min_temp = pod['remoteCapabilities']['modes']['cool']['temperatures']['C']['values'][0];
		    }else{
		        var count = pod['remoteCapabilities']['modes']['cool']['temperatures']['F']['values'].length;
		        cool_max_temp = pod['remoteCapabilities']['modes']['cool']['temperatures']['F']['values'][count - 1];
		        cool_min_temp = pod['remoteCapabilities']['modes']['cool']['temperatures']['F']['values'][0];
		    }
		}

		var swing_supported = false;
		if (heat_supported) {
			if (pod['remoteCapabilities']['modes']['heat']['swing'].length > 0) {
				swing_supported = true;
			}
		}else if (cool_supported) {
			if (pod['remoteCapabilities']['modes']['cool']['swing'].length > 0) {
				swing_supported = true;
			}
		}

		var fan_levels = [];
		if (heat_supported) {
			fan_levels = pod['remoteCapabilities']['modes']['heat']['fanLevels']
		}else if (cool_supported) {
			fan_levels = pod['remoteCapabilities']['modes']['cool']['fanLevels']
		}
		var auto_index = fan_levels.indexOf('auto');
		if (auto_index > -1) {
			fan_levels.splice(auto_index, 1);
		}

		var info = {
			model: model,
			heat_supported: heat_supported,
			heat_max_temp: heat_max_temp,
			heat_min_temp: heat_min_temp,
			cool_supported: cool_supported,
			cool_max_temp: cool_max_temp,
			cool_min_temp: cool_min_temp,
			swing_supported: swing_supported,
			fan_levels: fan_levels
		};
		return info;
	}

	generateStatus(pod){
		var status = {
			on: pod['acState']['on'],
			fanLevel: pod['acState']['fanLevel'],
			temperatureUnit: pod['acState']['temperatureUnit'],
			targetTemperature: pod['acState']['targetTemperature'],
			mode: pod['acState']['mode'],
			swing: pod['acState']['swing'],
			currentTemperature: pod['measurements']['temperature'],
			currentHumidity: pod['measurements']['humidity']
		};
		return status;
	}

	status_fetch(){
		var that = this;

		var url = 'https://home.sensibo.com/api/v2/users/me/pods?fields=*&apiKey=' + that.config.api_key;
		request.get(url)
		.then(function (parsedBody) {

			var pods = JSON.parse(parsedBody)['result'];

			if (pods != null && pods.length > 0) {
				that.accessories.forEach(function(accessory){
					pods.forEach(function(pod){
						if (accessory.context.id == pod.id && accessory.displayName == pod.room.name){
							accessory.context.status = that.generateStatus(pod);
							that.updateAccessoriesReachability(accessory.context.id, pod['connectionStatus']['isAlive']);
						}
					});
				});
			}else{
				that.log('Status update failed! Check connection to Sensibo or API key.');
			}
		})
		.catch(function (err) {
			console.log(err);
		});
	}
}


module.exports = {
	SensiboPlatform: SensiboPlatform,
	setHomebridge: setHomebridge
};
