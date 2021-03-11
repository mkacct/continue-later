"use strict";

function setTab(tabName) {
	document.querySelectorAll("main > div").forEach((item) => {item.style.display = "none";});
	document.querySelector("#" + tabName + "Content").style.display = "block";
	document.querySelectorAll("nav > button").forEach((item) => {item.className = "";});
	document.querySelector("#" + tabName + "Tab").className = "selected";
};

window.addEventListener("load", () => {
	chrome.runtime.getBackgroundPage((bg) => {
		let radioGroups = ["sort", "dismiss"];
		let checkboxes = ["expandDefault", "closeNewTab", "suppressRepeatCommands", "groupRestoredTabs"];
		radioGroups.forEach((item) => {
			document.querySelector("input[name=" + item + "][value= " + bg.settings[item] + "]").checked = true;
		});
		checkboxes.forEach((item) => {
			document.querySelector("input[name=" + item + "]").checked = bg.settings[item] == "yes";
		});
	});
	document.querySelector("#optionsTab").addEventListener("click", () => {setTab("options");});
	document.querySelector("#shortcutsTab").addEventListener("click", () => {switchTo("chrome://extensions/shortcuts");});
	document.querySelector("#aboutTab").addEventListener("click", () => {setTab("about");});
	document.querySelectorAll("input[type=radio]").forEach((item) => {
		item.addEventListener("change", (e) => {
			chrome.storage.local.get((res) => {
				let newSettings = res.settings ? res.settings : {};
				newSettings[e.target.name] = e.target.value;
				chrome.storage.local.set({settings: newSettings});
			});
		});
	});
	document.querySelectorAll("input[type=checkbox]").forEach((item) => {
		item.addEventListener("change", (e) => {
			chrome.storage.local.get((res) => {
				let newSettings = res.settings ? res.settings : {};
				newSettings[e.target.name] = e.target.checked ? "yes" : "no";
				chrome.storage.local.set({settings: newSettings});
			});
		});
	});
	document.querySelector("#versionNumber").appendChild(document.createTextNode(chrome.runtime.getManifest().version));
});

function switchTo(url, callback) {
	chrome.tabs.query({url: url}, (tabs) => {
		if (tabs[0]) {
			chrome.tabs.update(tabs[0].id, {active: true}, () => {
				chrome.windows.update(tabs[0].windowId, {focused: true}, () => {if (callback) {callback();}})
			})
		} else {
			chrome.tabs.create({url: url}, () => {if (callback) {callback();}});
		}
	});
}