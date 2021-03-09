"use strict";

var asides = [];
var settings = {};

let processing = true;
let lastCommandTime = 0;
let setCommandUsed = "";

function load() {
	chrome.storage.local.get((res) => {
		asides = res.asides ? res.asides : [];
		settings = res.settings ? res.settings : {};
		fillDefaultSettings(settings);
		let badgeText;
		if (asides.length == 0) {
			badgeText = "";
		} else if (asides.length > 9999) {
			badgeText = "?!";
		} else {
			badgeText = asides.length.toString();
		}
		chrome.browserAction.setBadgeText({text: badgeText});
		chrome.runtime.sendMessage("dataChanged");
		processing = false;
	});
}

load();
chrome.storage.onChanged.addListener(load);

chrome.commands.onCommand.addListener((command) => {
	if (settings.suppressRepeatCommands == "yes") {
		if (command == setCommandUsed) {return;}
		if (command == "10" || command == "20") {setCommandUsed = command;}
	}
	switch (command) {
		case "10": // set selection
			setTabs(false);
			break;
		case "20": // set window
			setTabs(true);
			break;
		case "30": // restore oldest
			restoreEntry(0);
			break;
		case "40": // restore newest
			restoreEntry(asides.length - 1);
			break;
	}
});

chrome.tabs.onActivated.addListener(() => {setCommandUsed = "";});
chrome.tabs.onHighlighted.addListener(() => {setCommandUsed = "";});
chrome.tabs.onUpdated.addListener(() => {setCommandUsed = "";});

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: "setPage",
		title: "Add page to Continue Later",
		contexts: ["page"]
	});
	chrome.contextMenus.create({
		id: "setLink",
		title: "Add to Continue Later",
		contexts: ["link"]
	});
});

chrome.contextMenus.onClicked.addListener((data) => {
	switch (data.menuItemId) {
		case "setPage":
			setTabs(false, true);
			break;
		case "setLink":
			setLink(data.linkUrl);
			break;
	}
});

function setTabs(isWindow, justThisOne, setId) {
	if (processing) {return;}
	processing = true;
	let opts = {currentWindow: true};
	if (justThisOne) {
		opts.active = true;
	} else if (!isWindow) {
		opts.highlighted = true;
	}
	getIndicatedTabs(opts, (tabs) => {
		if (tabs.length > 0) {
			let entry;
			let existingIndex;
			if (setId) {
				existingIndex = asides.findIndex((item) => {return item.id == setId});
				entry = {
					id: asides[existingIndex].id,
					time: asides[existingIndex].time,
					isWindow: asides[existingIndex].isWindow,
					tabs: asides[existingIndex].tabs.slice()
				};
			} else {
				entry = {
					id: uuidv4(),
					time: (new Date()).getTime(),
					isWindow: isWindow,
					tabs: []
				};
			}
			tabs.forEach((item) => {
				let tabEntry = {
					url: item.url,
					title: item.title,
					favIconUrl: item.favIconUrl
				};
				entry.tabs.push(tabEntry);
			});
			let newAsides;
			if (setId) {
				newAsides = asides.slice();
				newAsides.splice(existingIndex, 1, entry);
			} else {
				newAsides = asides.concat([entry]);
				newAsides.sort((a, b) => {return a.time - b.time;});
			}
			chrome.storage.local.set({asides: newAsides});
		} else {
			processing = false;
		}
	});
}

function setLink(url) {
	if (!isNewTab(url)) {
		let newAsides = asides.concat([{
			id: uuidv4(),
			time: (new Date()).getTime(),
			tabs: [{url: url}]
		}]);
		newAsides.sort((a, b) => {return a.time - b.time;});
		chrome.storage.local.set({asides: newAsides});
	}
}

function getIndicatedTabs(opts, callback) {
	chrome.tabs.query(opts, (res) => {
		callback(res.filter((tab) => {return !isNewTab(tab.url);}));
	});
}

function getIndex(id) {
	return asides.findIndex((item) => {return item.id == id;});
}

function restoreEntry(index, noDismiss) {
	if (processing) {return;}
	if (!asides[index]) {return;}
	processing = true;
	if (settings.openNewWindow == "yes" || (settings.openNewWindow == "ifWindow" && asides[index].isWindow) || (settings.openNewWindow == "ifMultiple" && asides[index].tabs.length > 1)) {
		chrome.windows.getCurrent((current) => {
			chrome.windows.create({
				focused: true,
				incognito: current ? current.incognito : false,
				url: asides[index].tabs.map((item) => {return item.url;})
			});
		});
	} else {
		chrome.tabs.query({
			currentWindow: true,
			active: true
		}, (currentTab) => {
			asides[index].tabs.forEach((item, i) => {
				chrome.tabs.create({
					url: item.url,
					active: i == 0
				});
			});
			if (settings.closeNewTab == "yes" && isNewTab(currentTab[0].url)) {
				chrome.tabs.remove(currentTab[0].id);
			}
		});
	}
	if (!noDismiss && settings.dismiss != "no") {
		dismissEntry(index);
	} else {
		processing = false;
	}
}

function dismissEntry(index) {
	let newAsides = asides.slice();
	newAsides.splice(index, 1);
	chrome.storage.local.set({asides: newAsides});
}

function restoreTab(entryIndex, tabIndex, noDismiss) {
	if (processing) {return;}
	if (!(asides[entryIndex] && asides[entryIndex].tabs[tabIndex])) {return;}
	processing = true;
	chrome.tabs.query({
		currentWindow: true,
		active: true
	}, (currentTab) => {
		chrome.tabs.create({url: asides[entryIndex].tabs[tabIndex].url});
		if (settings.closeNewTab == "yes" && isNewTab(currentTab[0].url)) {
			chrome.tabs.remove(currentTab[0].id);
		}
	});
	if (!noDismiss && settings.dismiss == "yes") {
		dismissTab(entryIndex, tabIndex);
	} else {
		processing = false;
	}
}

function dismissTab(entryIndex, tabIndex) {
	let newAsides = asides.slice();
	newAsides[entryIndex] = {
		id: asides[entryIndex].id,
		time: asides[entryIndex].time,
		isWindow: asides[entryIndex].isWindow,
		tabs: asides[entryIndex].tabs.slice()
	};
	newAsides[entryIndex].tabs.splice(tabIndex, 1);
	if (newAsides[entryIndex].tabs.length == 0) {newAsides.splice(entryIndex, 1);}
	chrome.storage.local.set({asides: newAsides});
}

function deleteAll() {
	processing = true;
	chrome.storage.local.set({asides: []});
}

function fillDefaultSettings(obj) {
	if (!obj.sort) {obj.sort = "desc";}
	if (!obj.expandDefault) {obj.expandDefault = "no";}
	if (!obj.dismiss) {obj.dismiss = "yes";}
	if (!obj.openNewWindow) {obj.openNewWindow = "no";}
	if (!obj.closeNewTab) {obj.closeNewTab = "yes";}
	if (!obj.suppressRepeatCommands) {obj.suppressRepeatCommands = "yes";}
}

function isNewTab(s) {
	return /^(?:chrome|edge):\/\/newtab\/?$/.test(s);
}

function uuidv4() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
}