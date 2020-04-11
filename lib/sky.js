'use strict';

var request = require('request-promise'),
	xml2js  = require('xml2js');

var Accessory, Service, Characteristic, UUIDGen;

function setHomebridge(homebridge) {
	Accessory = homebridge.platformAccessory;
	Service = homebridge.hap.Service;
	UUIDGen = homebridge.hap.uuid;
	Characteristic = homebridge.hap.Characteristic;
}

var setStateTimeout = 5000;
var setStateCalled = false;

class SensiboSkyAccessory {

	constructor(platform, accessory) {

		this.accessory = accessory;

		var that = this;

		this.log = platform.log;
		this.api = platform.api;
		this.config = platform.config;

		if (this.accessory.displayName == null || this.accessory.UUID == null || this.accessory.context.id == null) {
			this.log("returning, null found!");
			return;
		}

		this.state = {
			active: false,
			currentHeaterCoolerState: Characteristic.CurrentHeaterCoolerState.INACTIVE,
			targetHeaterCoolerState: Characteristic.TargetHeaterCoolerState.COOL,
			currentTemperature: 22,
			temperatureDisplayUnits: Characteristic.TemperatureDisplayUnits.CELSIUS,
			rotationSpeed: 0,
			swingMode: Characteristic.SwingMode.SWING_DISABLED,
			coolingThresholdTemperature: 24,
			heatingThresholdTemperature: 20,
			currentRelativeHumidity: 50
		};

		var new_accessory;

		if (this.accessory.getService(Service.HeaterCooler)) {
			new_accessory = this.accessory;
		}else{
			new_accessory = new Accessory(this.accessory.displayName, this.accessory.UUID);
		}

		new_accessory.reachable = true;

		new_accessory.context.id = this.accessory.context.id;
		new_accessory.context.info = this.accessory.context.info;
		new_accessory.context.status = this.accessory.context.status;

		new_accessory.on('identify', function(paired, callback) {
			console.log("Identify! (%s, %s)", new_accessory.displayName, new_accessory.context.id);
			callback();
		});


		var accessoryInfoService = new_accessory.getService(Service.AccessoryInformation) || new_accessory.addService(Service.AccessoryInformation, this.accessory.displayName);

		accessoryInfoService.setCharacteristic(Characteristic.Manufacturer, "Sensibo");
		accessoryInfoService.setCharacteristic(Characteristic.Model, "Sky");
		accessoryInfoService.setCharacteristic(Characteristic.SerialNumber, "Pod ID: " + this.accessory.context.id);


		var heaterCoolerService = new_accessory.getService(Service.HeaterCooler) || new_accessory.addService(Service.HeaterCooler, this.accessory.displayName);

		heaterCoolerService.getCharacteristic(Characteristic.Active)
		.on("get", function (callback) {
			that.updateState();
            callback(null, that.state.active);
		})
		.on("set", function (value, callback) {
			callback(null, that.state.active);
			that.setActive(value);
		});


		heaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
		.on("get", function (callback) {
			that.updateState();
            callback(null, that.state.currentHeaterCoolerState);
		});


		heaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState)
		.on("get", function (callback) {
			that.updateState();
            callback(null, that.state.targetHeaterCoolerState);
		})
		.on("set", function (value, callback) {
			callback(null, that.state.targetHeaterCoolerState);
			that.setTargetHeaterCoolerState(value);
		});


		if (new_accessory.context.info.cool_supported) {
			var coolingThresholdTemperatureCharacteristic = heaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature) || heaterCoolerService.addCharacteristic(Characteristic.CoolingThresholdTemperature);

			coolingThresholdTemperatureCharacteristic
			.on("get", function (callback) {
				that.updateState();
	            callback(null, that.state.coolingThresholdTemperature);
			})
			.on("set", function (value, callback) {
				callback(null, that.state.coolingThresholdTemperature);
				that.setCoolingThresholdTemperature(value);
			})
			.setProps({ maxValue: new_accessory.context.info.cool_max_temp, minValue: new_accessory.context.info.cool_min_temp, minStep: 1});
		}


		if (new_accessory.context.info.heat_supported) {
			var heatingThresholdTemperatureCharacteristic = heaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature) || heaterCoolerService.addCharacteristic(Characteristic.HeatingThresholdTemperature);

			heatingThresholdTemperatureCharacteristic
			.on("get", function (callback) {
				that.updateState();
	            callback(null, that.state.heatingThresholdTemperature);
			})
			.on("set", function (value, callback) {
				callback(null, that.state.heatingThresholdTemperature);
				that.setHeatingThresholdTemperature(value);
			})
			.setProps({ maxValue: new_accessory.context.info.heat_max_temp, minValue: new_accessory.context.info.heat_min_temp, minStep: 1});
		}


		heaterCoolerService.getCharacteristic(Characteristic.CurrentTemperature)
		.on("get", function (callback) {
			that.updateState();
            callback(null, that.state.currentTemperature);
		});


		var temperatureDisplayUnitsCharacteristic = heaterCoolerService.getCharacteristic(Characteristic.TemperatureDisplayUnits) || heaterCoolerService.addCharacteristic(Characteristic.TemperatureDisplayUnits);

		temperatureDisplayUnitsCharacteristic
		.on("get", function (callback) {
			that.updateState();
            callback(null, that.state.temperatureDisplayUnits);
		})
		.on("set", function (value, callback) {
			callback(null, that.state.temperatureDisplayUnits);
			that.setTemperatureDisplayUnits(value);
		});


		if (new_accessory.context.info.fan_levels != null && new_accessory.context.info.fan_levels != []) {
			var rotationSpeedCharacteristic = heaterCoolerService.getCharacteristic(Characteristic.RotationSpeed) || heaterCoolerService.addCharacteristic(Characteristic.RotationSpeed);

			rotationSpeedCharacteristic
			.on("get", function (callback) {
				that.updateState();
	            callback(null, that.state.rotationSpeed);
			})
			.on("set", function (value, callback) {
				callback(null, that.state.rotationSpeed);
				that.setRotationSpeed(value);
			})
			.setProps({ maxValue: 100, minValue: 0, minStep: 100 / new_accessory.context.info.fan_levels.length});
		}


		if (new_accessory.context.info.swing_supported) {
			var swingModeCharacteristic = heaterCoolerService.getCharacteristic(Characteristic.SwingMode) || heaterCoolerService.addCharacteristic(Characteristic.SwingMode);

			swingModeCharacteristic
			.on("get", function (callback) {
				that.updateState();
	            callback(null, that.state.swingMode);
			})
			.on("set", function (value, callback) {
				callback(null, that.state.swingMode);
				that.setSwingMode(value);
			});
		}


		var humiditySensorService = new_accessory.getService(Service.HumiditySensor) || new_accessory.addService(Service.HumiditySensor, this.accessory.displayName);

		humiditySensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
		.on("get", function (callback) {
			that.updateState();
            callback(null, that.state.currentRelativeHumidity);
		});

		this.accessory = new_accessory;
	}

	updateState() {

		var that = this;

		if (this.accessory.context.status.on){

			switch (this.accessory.context.status.mode) {
				case 'heat':
					this.state.active = true;
					this.state.currentHeaterCoolerState = Characteristic.CurrentHeaterCoolerState.HEAT;
					this.state.targetHeaterCoolerState = Characteristic.TargetHeaterCoolerState.HEAT;
					this.state.heatingThresholdTemperature = this.accessory.context.status.targetTemperature;
					break;
				case 'cool':
					this.state.active = true;
					this.state.currentHeaterCoolerState = Characteristic.CurrentHeaterCoolerState.COOL;
					this.state.targetHeaterCoolerState = Characteristic.TargetHeaterCoolerState.COOL;
					this.state.coolingThresholdTemperature = this.accessory.context.status.targetTemperature;
					break;
				default:
					this.state.active = false;
					this.state.currentHeaterCoolerState = Characteristic.CurrentHeaterCoolerState.INACTIVE;
					this.state.targetHeaterCoolerState = Characteristic.TargetHeaterCoolerState.INACTIVE;
			}

			if (this.accessory.context.status.fanLevel == 'auto') {
				this.state.rotationSpeed = 0;
			}else{
				var index = this.accessory.context.info.fan_levels.indexOf(this.accessory.context.status.fanLevel) + 1;
				this.state.rotationSpeed = index * (100 / this.accessory.context.info.fan_levels.length)
			}

		}else{
			this.state.active = false;
			this.state.currentHeaterCoolerState = Characteristic.CurrentHeaterCoolerState.INACTIVE;
			this.state.targetHeaterCoolerState = Characteristic.TargetHeaterCoolerState.INACTIVE;
			this.state.rotationSpeed = 0;
		}

		if (this.accessory.context.status.swing == 'stopped'){
			this.state.swingMode = Characteristic.SwingMode.SWING_DISABLED;
		}else{
			this.state.swingMode = Characteristic.SwingMode.SWING_ENABLED;
		}

		if (this.accessory.context.status.temperatureUnit == 'C'){
			this.state.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
		}else{
			this.state.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
		}

		this.state.currentTemperature = this.accessory.context.status.currentTemperature;
		this.state.currentRelativeHumidity = this.accessory.context.status.currentHumidity;
	}

	setState() {

		var that = this;

		function send_request() {

			var on, mode, fanLevel, targetTemperature, temperatureUnit, swing;

			if (that.state.rotationSpeed == 0){
				fanLevel = 'auto';
			}else{
				var index = (that.state.rotationSpeed / (100 / that.accessory.context.info.fan_levels.length)).toFixed();
				fanLevel = that.accessory.context.info.fan_levels[index - 1];
			}

			if (that.state.swingMode == Characteristic.SwingMode.SWING_ENABLED){
				swing = 'rangeFull';
			}else{
				swing = 'stopped';
			}

			if (that.state.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS){
				temperatureUnit = 'C';
			}else{
				temperatureUnit = 'F';
			}

			if (that.state.active){
				switch (that.state.targetHeaterCoolerState) {
					case Characteristic.TargetHeaterCoolerState.AUTO:
						on = that.accessory.context.status.on;
						mode = that.accessory.context.status.mode;
						targetTemperature = that.accessory.context.status.targetTemperature;
						break;
					case Characteristic.TargetHeaterCoolerState.COOL:
						on = true;
						mode = 'cool';
						targetTemperature = that.state.coolingThresholdTemperature;
						break;
					case Characteristic.TargetHeaterCoolerState.HEAT:
						on = true;
						mode = 'heat';
						targetTemperature = that.state.heatingThresholdTemperature;
						break;
					case Characteristic.TargetHeaterCoolerState.INACTIVE:
						on = false;
						mode = that.accessory.context.status.mode;
						targetTemperature = that.accessory.context.status.targetTemperature;
						fanLevel = that.accessory.context.status.fanLevel;
						swing = that.accessory.context.status.swing;
						break;
					default:
						on = false;
						mode = that.accessory.context.status.mode;
						targetTemperature = that.accessory.context.status.targetTemperature;
						fanLevel = that.accessory.context.status.fanLevel;
						swing = that.accessory.context.status.swing;
				}
			}else{
				on = false;
				mode = that.accessory.context.status.mode;
				targetTemperature = that.accessory.context.status.targetTemperature;
				fanLevel = that.accessory.context.status.fanLevel;
				swing = that.accessory.context.status.swing;
			}

			var body = {
				"acState":
				{
					"on": on,
					"mode": mode,
					"fanLevel": fanLevel,
					"targetTemperature": targetTemperature,
					"temperatureUnit": temperatureUnit,
					"swing": swing
				}
			};

			var url = 'https://home.sensibo.com/api/v2/pods/' + that.accessory.context.id + '/acStates?apiKey=' + that.config.api_key;
			request.post({url: url, json: body})
			.then(function (parsedBody) {
				that.accessory.context.status.on = on;
				that.accessory.context.status.mode = mode;
				that.accessory.context.status.fanLevel = fanLevel;
				that.accessory.context.status.targetTemperature = targetTemperature;
				that.accessory.context.status.temperatureUnit = temperatureUnit;
				that.accessory.context.status.swing = swing;
				that.updateState();
			})
			.catch(function (err) {
				console.log(err);
			});

			setStateCalled = false;
		}

		if (!setStateCalled) {
			setStateCalled = true;
			setTimeout(send_request, setStateTimeout);
		}
	}

	setActive(value){
		this.state.active = value;
		this.setState();
	}

	setTargetHeaterCoolerState(value){
		this.state.targetHeaterCoolerState = value;
		this.setState();
	}

	setCoolingThresholdTemperature(value){
		this.state.coolingThresholdTemperature = value;
		this.setState();
	}

	setHeatingThresholdTemperature(value){
		this.state.heatingThresholdTemperature = value;
		this.setState();
	}

	setTemperatureDisplayUnits(value){
		this.state.temperatureDisplayUnits = value;
		this.setState();
	}

	setRotationSpeed(value){
		this.state.rotationSpeed = value;
		this.setState();
	}

	setSwingMode(value){
		this.state.swingMode = value;
		this.setState();
	}
}

module.exports = {
	SensiboSkyAccessory: SensiboSkyAccessory,
	setHomebridge: setHomebridge
};
