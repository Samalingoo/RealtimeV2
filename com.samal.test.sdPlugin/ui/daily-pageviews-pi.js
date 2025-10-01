/**
 * Property Inspector for Daily Pageviews action
 */

const defaults = {
	customTitle: 'Daily Views',
	titleSize: 14,
	valueSize: 36,
	percentageSize: 16,
	titleY: 20,
	valueY: 72,
	percentageY: 124,
	backgroundColor: '#0f3460',
	textColor: '#ffffff',
	positiveColor: '#16c784',
	negativeColor: '#ea3943'
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

