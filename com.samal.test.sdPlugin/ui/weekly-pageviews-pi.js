/**
 * Property Inspector for Weekly Pageviews action
 */

const defaults = {
	customTitle: 'Weekly Users',
	titleSize: 14,
	valueSize: 36,
	percentageSize: 16,
	titleY: 20,
	valueY: 72,
	percentageY: 124,
	backgroundColor: '#2d3436',
	textColor: '#dfe6e9',
	positiveColor: '#00b894',
	negativeColor: '#d63031'
};

document.addEventListener('DOMContentLoaded', function() {
	const resetButton = document.getElementById('resetButton');
	if (resetButton) {
		resetButton.addEventListener('click', function() {
			// Reset all settings to defaults
			saveSettings(defaults);
			updateUI(defaults);
		});
	}
});

