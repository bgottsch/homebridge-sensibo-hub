# homebridge-sensibo-hub
[![npm](https://img.shields.io/npm/v/homebridge-sensibo-hub.svg)](https://www.npmjs.com/package/homebridge-sensibo-hub) [![npm](https://img.shields.io/npm/dt/homebridge-sensibo-hub.svg)](https://www.npmjs.com/package/homebridge-sensibo-hub)
This project creates a [Homebridge](https://github.com/nfarina/homebridge) plugin to expose [Sensibo](https://sensibo.com/) devices.

Inspired by the plugin [homebridge-sensibo](https://github.com/pdlove/homebridge-sensibo)

## Requirements
This pluing requires a [Sensibo](https://sensibo.com/) API key, which must be obtained from `https://home.sensibo.com/me/api`

## Installation

### Install using [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x)
1. Follow the instructions on [Homebridge](https://github.com/nfarina/homebridge) to install it
2. Open de Homebridge Config UI X admin panel
3. Search for `sensibo-hub` in the `Plugins` tab
4. Install the plugin and follow on screen setup instructions

### Instal manually
1. Follow the instructions on [Homebridge](https://github.com/nfarina/homebridge) to install it
2. Install this plugin using: `npm install -g homebridge-sensibo-hub`
3. Update your configuration file. See the snippet below or the file `config.example.json`

## Configuration

### Example
```
(...)
"platforms": [
	{
		"platform": "sensibo-hub",
		"name": "sensibo-hub",
		"api_key": "YOUR_SENSIBO_API_ID",
		"refresh_interval": 30000,
		"enable_fanDry": false
	}
]
(...)
```

### Fields
* "platform": Must always be "sensibo-hub" (required)
* "name": Can be anything (required)
* "api_key": Sensibo API key, must be obtained from `https://home.sensibo.com/me/api` (required)
* "refresh_interval": devices refresh interval in ms (optional, default=30000)
* "enable_fanDry": enable fan/dry mode on supported A/C's (optional, default=false)

## Usage Notes
* A fan speed of 0 means "auto".
* Debug mode supported, with `-D` tag. See [Homebridge](https://github.com/nfarina/homebridge) for details.
* The refresh interval variable must not be too small. If the plugin calls the API too much, the used key may get revoked. The default value should be fine.

**Fan/Dry Mode:**
When enabled, and if the A/C supports fan and dry modes, the accessory will display a switch used to enable/disable this mode. When the switch is active, the cool/heat modes will be "replaced" by fan/dry modes, respectively.

## Issues and improvements
Please use the [issues](https://github.com/bgottsch/homebridge-sensibo-hub/issues) section of this repository to discuss problems with the plugin or possible improvements to it.

## Credits
* This project would not be possible if not by [Homebridge](https://github.com/nfarina/homebridge)
* This project uses the [Sensibo](https://sensibo.com/) as documented [here](https://sensibo.github.io/)

This project is not affiliated with [Sensibo](https://sensibo.com/) nor with [Homebridge](https://github.com/nfarina/homebridge), and was designed with a personal/hobbyist usage in mind.

### Dependencie
* [request](https://www.npmjs.com/package/request)
* [request-promise](https://www.npmjs.com/package/request-promise)
* [xml2js](https://www.npmjs.com/package/xml2js)
* [json-diff](https://www.npmjs.com/package/json-diff)