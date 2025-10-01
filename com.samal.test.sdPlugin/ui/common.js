/**
 * Common Property Inspector utilities for Stream Deck
 */

let websocket = null;
let uuid = null;
let actionInfo = {};
let settingsCache = {};

// Connect to Stream Deck
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
	uuid = inUUID;
	actionInfo = JSON.parse(inActionInfo);
	
	websocket = new WebSocket('ws://127.0.0.1:' + inPort);

	websocket.onopen = function () {
		const json = {
			event: inRegisterEvent,
			uuid: inUUID
		};
		websocket.send(JSON.stringify(json));
		
		// Request current settings
		requestSettings();
	};

	websocket.onmessage = function (evt) {
		const jsonObj = JSON.parse(evt.data);
		const event = jsonObj['event'];
		const jsonPayload = jsonObj['payload'];

		if (event === 'didReceiveSettings') {
			settingsCache = jsonPayload.settings;
			updateUI(settingsCache);
		}
	};
}

// Send settings to plugin
function sendSettings(payload) {
	if (websocket) {
		const json = {
			event: 'sendToPlugin',
			context: uuid,
			payload: payload
		};
		websocket.send(JSON.stringify(json));
	}
}

// Debounce timer for settings
let saveSettingsTimer = null;

// Save settings with debouncing
function saveSettings(settings) {
	// Update cache immediately
	settingsCache = { ...settingsCache, ...settings };
	
	// Debounce the save to prevent too many updates
	if (saveSettingsTimer) {
		clearTimeout(saveSettingsTimer);
	}
	
	saveSettingsTimer = setTimeout(() => {
		if (websocket) {
			const json = {
				event: 'setSettings',
				context: uuid,
				payload: settingsCache
			};
			websocket.send(JSON.stringify(json));
		}
	}, 300); // 300ms debounce
}

// Request current settings
function requestSettings() {
	if (websocket) {
		const json = {
			event: 'getSettings',
			context: uuid
		};
		websocket.send(JSON.stringify(json));
	}
}

// Update UI with current settings
function updateUI(settings) {
	for (const key in settings) {
		const element = document.getElementById(key);
		if (element) {
			if (element.type === 'checkbox') {
				element.checked = settings[key];
			} else if (element.type === 'range') {
				element.value = settings[key];
				// Update range value display
				const span = document.querySelector(`span[data-target="${key}"]`);
				if (span) {
					span.textContent = settings[key];
				}
			} else {
				element.value = settings[key];
			}
		}
	}
}

// Setup event listeners for all inputs
document.addEventListener('DOMContentLoaded', function() {
	// Text inputs
	document.querySelectorAll('input[type="text"], input[type="color"]').forEach(input => {
		input.addEventListener('change', function() {
			const settings = {};
			settings[this.id] = this.value;
			saveSettings(settings);
		});
	});

	// Range inputs
	document.querySelectorAll('input[type="range"]').forEach(input => {
		input.addEventListener('input', function() {
			const span = document.querySelector(`span[data-target="${this.id}"]`);
			if (span) {
				span.textContent = this.value;
			}
			// Save on input for immediate feedback
			const settings = {};
			settings[this.id] = parseInt(this.value);
			saveSettings(settings);
		});
	});

	// Checkboxes
	document.querySelectorAll('input[type="checkbox"]').forEach(input => {
		input.addEventListener('change', function() {
			const settings = {};
			settings[this.id] = this.checked;
			saveSettings(settings);
		});
	});
	
	// Range value click to input
	document.querySelectorAll('span.clickable').forEach(span => {
		span.addEventListener('click', function() {
			const targetId = this.getAttribute('data-target');
			const input = document.getElementById(targetId);
			if (input) {
				const newValue = prompt('Enter value:', input.value);
				if (newValue !== null && !isNaN(newValue)) {
					input.value = newValue;
					this.textContent = newValue;
					const settings = {};
					settings[targetId] = parseInt(newValue);
					saveSettings(settings);
				}
			}
		});
	});
});

