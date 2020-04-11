# homebridge-sensibo
[Homebridge](https://github.com/nfarina/homebridge) platform plugin for the Sensibo

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g bgottsch/homebridge-sensibo`
3. Update your configuration file. See sample `config.json` snippet below. 

# Configuration

Configuration sample:

 ```
"platforms": [
		{
			"platform": "Sensibo",
			"name": "Sensibo",
			"api_key": "YOUR_SENSIBO_API_ID",
			"refresh_interval": 30000
		}
	],

```

Fields: 

* "platform": Must always be "Sensibo" (required)
* "name": Can be anything (required)
* "apiKey": Sensibo API key, must be obtained from `https://home.sensibo.com/me/api` (required)

# Usage Notes

* This should work but I am getting some messages from the API that indicate an incorrect setup on my test unit. Please try it and let me know if you have problems. Errors from the API are logged in output.  
* The fan shows as a different Service on the Accessory that has it's own on off and speed control.
* If the fan is turned on, the system is switched to "fan" mode and AC or heat will be turned off.
* The fan speed control should work even in Cool or Heat mode.
* A fan speed of 0 means "auto". Otherwise it makes a logical progression from low to high.
