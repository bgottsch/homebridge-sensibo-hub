"use strict";

const request   = require("request-promise");
const xml2js    = require("xml2js");
const jsonDiff  = require("json-diff");

var Service, Characteristic;


module.exports = PodSky;


function PodSky(hub, accessory) {

	var that = this;

	this.log = hub.log;
	this.api = hub.api;
	this.config = hub.config;

	Service = this.api.hap.Service;
	Characteristic = this.api.hap.Characteristic;

	this.accessory = accessory;

	if (this.accessory.displayName == null || this.accessory.UUID == null || this.accessory.context.info == null || this.accessory.context.state == null) {
		this.log.warn("Error adding accessory, null found! (info: %s, state: %s)", this.accessory.context.info, this.accessory.context.state);
		return;
	}

	// Heater Cooler Properties
	this.hk_heaterCooler_state = true;
	this.hk_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.INACTIVE;
	this.hk_heaterCooler_targHCState = Characteristic.TargetHeaterCoolerState.COOL;
	this.hk_heaterCooler_heatThTemp = 20;
	this.hk_heaterCooler_coolThTemp = 24;
	this.hk_heaterCooler_currTemp = 22;
	this.hk_heaterCooler_tempDispUnit = Characteristic.TemperatureDisplayUnits.CELSIUS;

	// Fan Properties
	this.hk_fan_state = true;
	this.hk_fan_rotSpeed = 0;
	this.hk_fan_swingMode = Characteristic.SwingMode.SWING_DISABLED;

	// Humidity Sensor Properties
	this.hk_humiditySensor_currtRelHum = 50;

	// Fan/Dry Switch Properties
	this.hk_switch_state = false;


	this.blockExternalUpdates = false;
	this.blockSetState = false;
	this.blockSetTempUnit = false;
	this.setStateCalled = false;

	
	// Identify
	this.accessory.on("identify", function(paired, callback) {
		that.log.debug("Identify! (%s, %s)", that.accessory.displayName, that.accessory.context.info["id"]);
		callback();
	});


	// Service Info
	var accessoryInfoService = this.accessory.getService(Service.AccessoryInformation) || this.accessory.addService(Service.AccessoryInformation, this.accessory.displayName);

	accessoryInfoService.setCharacteristic(Characteristic.Manufacturer, "Sensibo");
	accessoryInfoService.setCharacteristic(Characteristic.Model, "Sky");
	accessoryInfoService.setCharacteristic(Characteristic.SerialNumber, "ID: " + this.accessory.context.info["id"]);


	// Service Heater Cooler
	var heaterCoolerService = this.accessory.getService(Service.HeaterCooler) || this.accessory.addService(Service.HeaterCooler, this.accessory.displayName);

	heaterCoolerService.getCharacteristic(Characteristic.Active)
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_heaterCooler_state);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.setState();
			that.hk_heaterCooler_state = value;
		}else{
			callback("no_response");
		}
	});

	heaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_heaterCooler_currHCState);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.hk_heaterCooler_currHCState = value;
		}else{
			callback("no_response");
		}
	});

	heaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState)
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_heaterCooler_targHCState);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.setState();
			that.hk_heaterCooler_targHCState = value;
		}else{
			callback("no_response");
		}
	});

	var heatingThresholdTemperatureCharacteristic = heaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature) || heaterCoolerService.addCharacteristic(Characteristic.HeatingThresholdTemperature);
	heatingThresholdTemperatureCharacteristic
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_heaterCooler_heatThTemp);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.setState();
			that.hk_heaterCooler_heatThTemp = value;
		}else{
			callback("no_response");
		}
	})
	.setProps({ maxValue: this.accessory.context.info["maxTemp"], minValue: this.accessory.context.info["minTemp"], minStep: 1});

	var coolingThresholdTemperatureCharacteristic = heaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature) || heaterCoolerService.addCharacteristic(Characteristic.CoolingThresholdTemperature);
	coolingThresholdTemperatureCharacteristic
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_heaterCooler_coolThTemp);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.setState();
			that.hk_heaterCooler_coolThTemp = value;
		}else{
			callback("no_response");
		}
	})
	.setProps({ maxValue: this.accessory.context.info["maxTemp"], minValue: this.accessory.context.info["minTemp"], minStep: 1});

	heaterCoolerService.getCharacteristic(Characteristic.CurrentTemperature)
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_heaterCooler_currTemp);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.hk_heaterCooler_currTemp = value;
		}else{
			callback("no_response");
		}
	});

	heaterCoolerService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_heaterCooler_tempDispUnit);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.setTempUnit();
			that.hk_heaterCooler_tempDispUnit = value;
		}else{
			callback("no_response");
		}
	});


	// Service Fan
	var fanService = this.accessory.getService(Service.Fanv2) || this.accessory.addService(Service.Fanv2, this.accessory.displayName + " Rotation and Swing");

	fanService.getCharacteristic(Characteristic.Active)
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_fan_state);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.setState();
			that.hk_fan_state = value;
		}else{
			callback("no_response");
		}
	});


	var rotationSpeedCharacteristic = fanService.getCharacteristic(Characteristic.RotationSpeed) || fanService.addCharacteristic(Characteristic.RotationSpeed);
	rotationSpeedCharacteristic
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_fan_rotSpeed);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.setState();
			that.hk_fan_rotSpeed = value;
		}else{
			callback("no_response");
		}
	})
	.setProps({ maxValue: 100, minValue: 0, minStep: 100 / this.accessory.context.info["fanLevels"].length});


	if (this.accessory.context.info["swingSupported"]) {
		var swingModeCharacteristic = fanService.getCharacteristic(Characteristic.SwingMode) || fanService.addCharacteristic(Characteristic.SwingMode);
		swingModeCharacteristic
		.on("get", function (callback) {
			if (that.accessory.reachable) {
				callback(null, that.hk_fan_swingMode);
			}else{
				callback("no_response");
			}
		})
		.on("set", function (value, callback) {
			if (that.accessory.reachable) {
				callback(null, value);
				that.setState();
				that.hk_fan_swingMode = value;
			}else{
				callback("no_response");
			}
		});
	}


	// Service Humidity Sensor
	var humiditySensorService = this.accessory.getService(Service.HumiditySensor) || this.accessory.addService(Service.HumiditySensor, this.accessory.displayName + " Humidity Sensor");

	humiditySensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
	.on("get", function (callback) {
		if (that.accessory.reachable) {
			callback(null, that.hk_humiditySensor_currtRelHum);
		}else{
			callback("no_response");
		}
	})
	.on("set", function (value, callback) {
		if (that.accessory.reachable) {
			callback(null, value);
			that.hk_humiditySensor_currtRelHum = value;
		}else{
			callback("no_response");
		}
	})
	.setProps({ maxValue: 100, minValue: 0, minStep: 0.1});

	
	// Service Fan/Dry Switch
	if (this.accessory.context.info["fanDryModeSupported"]) {
		var switchService = this.accessory.getService(Service.Switch) || this.accessory.addService(Service.Switch, this.accessory.displayName + " Fan/Dry Switch");

		switchService.getCharacteristic(Characteristic.On)
		.on("get", function(callback) {
			if (that.accessory.reachable) {
				callback(null, that.hk_switch_state);
			}else{
				callback("no_response");
			}
		})
		.on("set", function (value, callback) {
			if (that.accessory.reachable) {
				callback(null, value);
				that.setState();
				that.hk_switch_state = value;
			}else{
				callback("no_response");
			}
		});
	}

}


PodSky.prototype.updateState = function() {

	var that = this;

	// Heater Cooler Properties
	var curr_heaterCooler_state = this.hk_heaterCooler_state;
	var curr_heaterCooler_currHCState = this.hk_heaterCooler_currHCState;
	var curr_heaterCooler_targHCState = this.hk_heaterCooler_targHCState;
	var curr_heaterCooler_heatThTemp = this.hk_heaterCooler_heatThTemp;
	var curr_heaterCooler_coolThTemp = this.hk_heaterCooler_coolThTemp;
	var curr_heaterCooler_currTemp = this.hk_heaterCooler_currTemp;
	var curr_heaterCooler_tempDispUnit = this.hk_heaterCooler_tempDispUnit;

	// Fan Properties
	var curr_fan_state = this.hk_fan_state;
	var curr_fan_rotSpeed = this.hk_fan_rotSpeed;
	var curr_fan_swingMode = this.hk_fan_swingMode;

	// Humidity Sensor Properties
	var curr_humiditySensor_currtRelHum = this.hk_humiditySensor_currtRelHum;

	// Fan/Dry Switch Properties
	var curr_switch_state = this.hk_switch_state;


	// State Mesurements
	curr_heaterCooler_currTemp = this.accessory.context.state["currentTemperature"];
	curr_humiditySensor_currtRelHum = this.accessory.context.state["currentHumidity"];

	// Display Unit
	if (this.accessory.context.state["temperatureUnit"] == "F"){
		curr_heaterCooler_tempDispUnit = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
	}else{
		curr_heaterCooler_tempDispUnit = Characteristic.TemperatureDisplayUnits.CELSIUS;
	}

	// State
	if (this.accessory.context.state["on"]) {

		curr_fan_state = true;

		if (this.accessory.context.state["fanLevel"] == "auto") {
			curr_fan_rotSpeed = 0;
		}else{
			var index = this.accessory.context.info["fanLevels"].indexOf(this.accessory.context.state["fanLevel"]) + 1;
			curr_fan_rotSpeed = index * (100 / this.accessory.context.info["fanLevels"].length)
		}

		if (this.accessory.context.state["swing"] == "stopped"){
			curr_fan_swingMode = Characteristic.SwingMode.SWING_DISABLED;
		}else{
			curr_fan_swingMode = Characteristic.SwingMode.SWING_ENABLED;
		}

		if (this.accessory.context.state["mode"] != "auto") {
			var targetTemperature = this.accessory.context.state["targetTemperature"];;
			if (that.accessory.context.state["temperatureUnit"] == "F") {
				targetTemperature = Math.round((targetTemperature - 32) * 5/9);
			}
			curr_heaterCooler_heatThTemp = targetTemperature;
			curr_heaterCooler_coolThTemp = targetTemperature;
		}

		switch (this.accessory.context.state["mode"]) {

			case "auto":
				curr_heaterCooler_state = true;
				curr_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.IDLE;
				curr_heaterCooler_targHCState = Characteristic.TargetHeaterCoolerState.AUTO;
				curr_switch_state = false;
				break;

			case "heat":
				curr_heaterCooler_state = true;
				curr_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.HEATING;
				curr_heaterCooler_targHCState = Characteristic.TargetHeaterCoolerState.HEAT;
				curr_switch_state = false;
				break;

			case "cool":
				curr_heaterCooler_state = true;
				curr_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.COOLING;
				curr_heaterCooler_targHCState = Characteristic.TargetHeaterCoolerState.COOL;
				curr_switch_state = false;
				break;

			case "fan":
				if (this.accessory.context.info["fanDryModeSupported"]) {
					curr_heaterCooler_state = true;
					curr_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.COOLING;
					curr_heaterCooler_targHCState = Characteristic.TargetHeaterCoolerState.COOL;
					curr_switch_state = true;
				}
				break;

			case "dry":
				if (this.accessory.context.info["fanDryModeSupported"]) {
					curr_heaterCooler_state = true;
					curr_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.HEATING;
					curr_heaterCooler_targHCState = Characteristic.TargetHeaterCoolerState.HEAT;
					curr_switch_state = true;
				}
				break;

		}

		// If in Fan or Dry mode and feature not supported --> turn off
		if ((this.accessory.context.state["mode"] == "dry" || this.accessory.context.state["mode"] == "fan") && (!this.accessory.context.info["fanDryModeSupported"])) {
			curr_heaterCooler_state = false;
			curr_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.INACTIVE;
			curr_fan_state = false;
			curr_switch_state = false;
		}

	}else{
		curr_heaterCooler_state = false;
		curr_heaterCooler_currHCState = Characteristic.CurrentHeaterCoolerState.INACTIVE;
		curr_fan_state = false;
		curr_switch_state = false;
	}


	// Sync HK Characteristics
	if (this.hk_heaterCooler_state != curr_heaterCooler_state) {
		this.blockSetState = true;
		this.accessory.getService(Service.HeaterCooler)
					  .getCharacteristic(Characteristic.Active)
					  .setValue(curr_heaterCooler_state);
		this.log.debug("Sync heaterCooler_state (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_heaterCooler_state);
		this.blockSetState = false;
	}

	if (this.hk_heaterCooler_currHCState != curr_heaterCooler_currHCState) {
		this.accessory.getService(Service.HeaterCooler)
					  .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
					  .setValue(curr_heaterCooler_currHCState);
		this.log.debug("Sync heaterCooler_currHCState (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_heaterCooler_currHCState);
	}

	if (this.hk_heaterCooler_targHCState != curr_heaterCooler_targHCState) {
		this.blockSetState = true;
		this.accessory.getService(Service.HeaterCooler)
					  .getCharacteristic(Characteristic.TargetHeaterCoolerState)
					  .setValue(curr_heaterCooler_targHCState);
		this.log.debug("Sync heaterCooler_targHCState (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_heaterCooler_targHCState);
		this.blockSetState = false;
	}

	if (this.hk_heaterCooler_heatThTemp != curr_heaterCooler_heatThTemp) {
		this.blockSetState = true;
		this.accessory.getService(Service.HeaterCooler)
					  .getCharacteristic(Characteristic.HeatingThresholdTemperature)
					  .setValue(curr_heaterCooler_heatThTemp);
		this.log.debug("Sync heaterCooler_heatThTemp (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_heaterCooler_heatThTemp);
		this.blockSetState = false;
	}

	if (this.hk_heaterCooler_coolThTemp != curr_heaterCooler_coolThTemp) {
		this.blockSetState = true;
		this.accessory.getService(Service.HeaterCooler)
					  .getCharacteristic(Characteristic.CoolingThresholdTemperature)
					  .setValue(curr_heaterCooler_coolThTemp);
		this.log.debug("Sync heaterCooler_coolThTemp (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_heaterCooler_coolThTemp);
		this.blockSetState = false;
	}

	if (this.hk_heaterCooler_currTemp != curr_heaterCooler_currTemp) {
		this.accessory.getService(Service.HeaterCooler)
					  .getCharacteristic(Characteristic.CurrentTemperature)
					  .setValue(curr_heaterCooler_currTemp);
		this.log.debug("Sync heaterCooler_currTemp (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_heaterCooler_currTemp);
	}

	if (this.hk_heaterCooler_tempDispUnit != curr_heaterCooler_tempDispUnit) {
		this.blockSetTempUnit = true;
		this.accessory.getService(Service.HeaterCooler)
					  .getCharacteristic(Characteristic.TemperatureDisplayUnits)
					  .setValue(curr_heaterCooler_tempDispUnit);
		this.log.debug("Sync heaterCooler_tempDispUnit (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_heaterCooler_tempDispUnit);
		this.blockSetTempUnit = false;
	}

	if (this.hk_fan_state != curr_fan_state) {
		this.blockSetState = true;
		this.accessory.getService(Service.Fanv2)
					  .getCharacteristic(Characteristic.Active)
					  .setValue(curr_fan_state);
		this.log.debug("Sync fan_state (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_fan_state);
		this.blockSetState = false;
	}

	if (this.hk_fan_rotSpeed != curr_fan_rotSpeed) {
		this.blockSetState = true;
		this.accessory.getService(Service.Fanv2)
					  .getCharacteristic(Characteristic.RotationSpeed)
					  .setValue(curr_fan_rotSpeed);
		this.log.debug("Sync fan_rotSpeed (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_fan_rotSpeed);
		this.blockSetState = false;
	}

	if (this.accessory.context.info["swingSupported"]){

		if (this.hk_fan_swingMode != curr_fan_swingMode) {
			this.blockSetState = true;
			this.accessory.getService(Service.Fanv2)
						  .getCharacteristic(Characteristic.SwingMode)
						  .setValue(curr_fan_swingMode);
			this.log.debug("Sync fan_swingMode (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_fan_swingMode);
			this.blockSetState = false;
		}
	}

	if (this.hk_humiditySensor_currtRelHum != curr_humiditySensor_currtRelHum) {
		this.accessory.getService(Service.HumiditySensor)
					  .getCharacteristic(Characteristic.CurrentRelativeHumidity)
					  .setValue(curr_humiditySensor_currtRelHum);
		this.log.debug("Sync humiditySensor_currtRelHum (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_humiditySensor_currtRelHum);
	}

	if (this.accessory.context.info["fanDryModeSupported"]){

		if (this.hk_switch_state != curr_switch_state) {
			this.blockSetState = true;
			this.accessory.getService(Service.Switch)
						  .getCharacteristic(Characteristic.On)
						  .setValue(curr_switch_state);
			this.log.debug("Sync switch_state (%s, %s): %s", this.accessory.displayName, this.accessory.context.info["id"], curr_switch_state);
			this.blockSetState = false;
		}
	}

}


PodSky.prototype.setState = function() {

	var that = this;

	function send_request() {

		var acState = {
			"on": that.accessory.context.state["on"],
			"mode": that.accessory.context.state["mode"],
			"fanLevel": that.accessory.context.state["fanLevel"],
			"targetTemperature": that.accessory.context.state["targetTemperature"],
			"temperatureUnit": that.accessory.context.state["temperatureUnit"],
			"swing": that.accessory.context.state["swing"]
		}

		if (that.hk_heaterCooler_state) {

			acState["on"] = true;

			if (that.hk_fan_rotSpeed == 0) {
				acState["fanLevel"] = "auto";
			}else{
				var index = (that.hk_fan_rotSpeed / (100 / that.accessory.context.info["fanLevels"].length)).toFixed();
				acState["fanLevel"] = that.accessory.context.info["fanLevels"][index - 1];
			}
	
			if (that.hk_fan_swingMode == Characteristic.SwingMode.SWING_ENABLED) {
				acState["swing"] = "rangeFull";
			}else{
				acState["swing"] = "stopped";
			}

			switch (that.hk_heaterCooler_targHCState) {

				case Characteristic.TargetHeaterCoolerState.AUTO:
					acState["mode"] = "auto";
					break;

				case Characteristic.TargetHeaterCoolerState.HEAT:

					if (that.hk_switch_state) {
						acState["mode"] = "dry";
						acState["targetTemperature"] = that.hk_heaterCooler_heatThTemp;
					}else{
						acState["mode"] = "heat";
						acState["targetTemperature"] = that.hk_heaterCooler_heatThTemp;
					}
					break;

				case Characteristic.TargetHeaterCoolerState.COOL:

					if (that.hk_switch_state) {
						acState["mode"] = "fan";
						acState["targetTemperature"] = that.hk_heaterCooler_coolThTemp;
					}else{
						acState["mode"] = "cool";
						acState["targetTemperature"] = that.hk_heaterCooler_coolThTemp;
					}
					break;

			}

		}else{
			acState["on"] = false;
		}

		var currState = Object.assign({}, that.accessory.context.state);
		delete currState["currentTemperature"];
		delete currState["currentHumidity"];

		var diff = jsonDiff.diffString(currState, acState);
		if (diff.length == 0) {
			that.updateState();
			that.blockExternalUpdates = false;
			that.setStateCalled = false;
			return;
		}

		if (acState["temperatureUnit"] == "F") {
			acState["targetTemperature"] = Math.round((acState["targetTemperature"] * 9/5) + 32);
		}

		var body = { acState };
		
		var url = "https://home.sensibo.com/api/v2/pods/" + that.accessory.context.info["id"] + "/acStates?apiKey=" + that.config.api_key;
		request.post({url: url, json: body})
		.then(function (parsedBody) {

			var acState = parsedBody["result"]["acState"];

			that.accessory.context.state["on"] = acState["on"];
			that.accessory.context.state["mode"] = acState["mode"];
			that.accessory.context.state["targetTemperature"] = acState["targetTemperature"];
			that.accessory.context.state["temperatureUnit"] = acState["temperatureUnit"];
			that.accessory.context.state["fanLevel"] = acState["fanLevel"];
			that.accessory.context.state["swing"] = acState["swing"];

			that.updateState();
			that.blockExternalUpdates = false;
			that.setStateCalled = false;

		})
		.catch(function (err) {
			that.blockExternalUpdates = false;
			that.setStateCalled = false;
			that.log.debug("Set state error (%s, %s):\n%s", that.accessory.displayName, that.accessory.context.info["id"], err);
		});
	}

	if (!this.setStateCalled && !this.blockSetState) {
		this.blockExternalUpdates = true;
		this.setStateCalled = true;
		setTimeout(send_request, 1000);
	}
}


PodSky.prototype.setTempUnit = function() {

	var that = this;

	function send_request() {

		var body;
		if (that.hk_heaterCooler_tempDispUnit == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
			body = { "newValue": "F" };
		}else{
			body = { "newValue": "C" };
		}

		if (that.accessory.context.state["temperatureUnit"] == body["newValue"]) {
			that.updateState();
			that.blockExternalUpdates = false;
			that.setStateCalled = false;
			return;
		}
		
		var url = "https://home.sensibo.com/api/v2/pods/" + that.accessory.context.info["id"] + "/acStates/temperatureUnit?apiKey=" + that.config.api_key;
		request.patch({url: url, json: body})
		.then(function (parsedBody) {

			var acState = parsedBody["result"]["acState"];

			that.accessory.context.state["on"] = acState["on"];
			that.accessory.context.state["mode"] = acState["mode"];
			that.accessory.context.state["targetTemperature"] = acState["targetTemperature"];
			that.accessory.context.state["temperatureUnit"] = acState["temperatureUnit"];
			that.accessory.context.state["fanLevel"] = acState["fanLevel"];
			that.accessory.context.state["swing"] = acState["swing"];

			that.updateState();
			that.blockExternalUpdates = false;
			that.setStateCalled = false;

		})
		.catch(function (err) {
			that.blockExternalUpdates = false;
			that.setStateCalled = false;
			that.log.debug("Set temp unit error (%s, %s):\n%s", that.accessory.displayName, that.accessory.context.info["id"], err);
		});
	}

	if (!this.setStateCalled && !this.blockSetTempUnit) {
		this.blockExternalUpdates = true;
		this.setStateCalled = true;
		setTimeout(send_request, 1000);
	}
}
