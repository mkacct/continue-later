"use strict";

// i'm so sorry future me

let seen = [];
let expanded = [];
let clickedMenuButton;

function load() {
	chrome.runtime.getBackgroundPage((bg) => {
		let list = document.createElement("div");
		list.id = "list";
		bg.asides.forEach((item) => {
			let el = document.createElement("div");
			let isUnseen = seen.indexOf(item.id) == -1;
			if ((bg.settings.expandDefault == "yes") && isUnseen) {expanded.push(item.id);}
			if (isUnseen) {seen.push(item.id);}
			if (expanded.indexOf(item.id) >= 0) {el.className = "expanded";}
			let topContainer = document.createElement("div");
			topContainer.className = "buttonContainer";
			let top = document.createElement("button");
			top.className = "entryButton";
			let entryTitle = document.createElement("span");
			entryTitle.className = "entryTitle";
			entryTitle.innerText = item.tabs.length + " page" + ((item.tabs.length == 1) ? "" : "s");
			top.appendChild(entryTitle);
			if (item.isWindow) {
				let windowIcon = document.createElement("i");
				windowIcon.innerHTML = "<i class=\"far fa-window-maximize\"></i>";
				top.appendChild(windowIcon);
			}
			let entryTime = document.createElement("span");
			entryTime.className = "entryTime";
			entryTime.innerText = durationText((new Date()).getTime() - item.time);
			top.appendChild(entryTime);
			top.appendChild(document.createElement("br"));
			let desc = (item.tabs[0].title ? item.tabs[0].title : item.tabs[0].url) + ((item.tabs.length > 1) ? (" and " + (item.tabs.length - 1) + " more") : "");
			top.appendChild(document.createTextNode(desc));
			top.title = desc;
			top.addEventListener("click", () => {
				chrome.runtime.getBackgroundPage((bg) => {
					bg.restoreEntry(bg.getIndex(item.id));
					window.close();
				});
			});
			topContainer.appendChild(top);
			topContainer.appendChild(menuButton(item));
			el.appendChild(topContainer);
			let pageList = document.createElement("div");
			pageList.className = "pageList";
			item.tabs.forEach((jtem, j) => {
				let pageButtonContainer = document.createElement("div");
				pageButtonContainer.className = "buttonContainer";
				let pageButton = document.createElement("button");
				let pageIcon = document.createElement("img");
				pageIcon.src = jtem.favIconUrl ? jtem.favIconUrl : chrome.runtime.getURL("res/page.png");
				pageButton.appendChild(pageIcon);
				pageButton.appendChild(document.createTextNode(jtem.title ? jtem.title : jtem.url));
				pageButton.title = jtem.title ? jtem.title : jtem.url;
				pageButton.addEventListener("click", () => {
					chrome.runtime.getBackgroundPage((bg) => {
						bg.restoreTab(bg.getIndex(item.id), j);
						window.close();
					});
				});
				pageButtonContainer.appendChild(pageButton);
				pageButtonContainer.appendChild(menuButton(item, j));
				pageList.appendChild(pageButtonContainer);
			});
			el.appendChild(pageList);
			let expandButton = document.createElement("button");
			expandButton.className = "expandButton linklike";
			expandButton.addEventListener("click", (e) => {
				if (expanded.indexOf(item.id) == -1) {
					expanded.push(item.id);
					e.target.parentElement.className = "expanded";
				} else {
					expanded.splice(expanded.indexOf(item.id), 1);
					e.target.parentElement.className = "";
				}
			});
			el.appendChild(expandButton);
			if (bg.settings.sort == "asc") {
				list.appendChild(el);
			} else {
				list.insertBefore(el, list.firstChild);
			}
		});
		if (bg.asides.length == 0) {
			let noAsides = document.createElement("div");
			noAsides.innerText = "Your list is empty.";
			noAsides.id = "noAsides";
			list.appendChild(noAsides);
		}
		let container = document.querySelector("#container");
		if (container.firstChild) {container.removeChild(container.firstChild);}
		container.appendChild(list);
		closeMenu();
	});
}

function updateAddButtons() {
	chrome.runtime.getBackgroundPage((bg) => {
		bg.getIndicatedTabs(false, (selected) => {
			chrome.runtime.getBackgroundPage((bg) => {
				bg.getIndicatedTabs(true, (inWindow) => {
					document.querySelector("#addTabButton").disabled = selected.length == 0;
					document.querySelector("#addWindowButton").disabled = inWindow.length == 0;
					document.querySelector("#addTabText").innerText = (selected.length > 1) ? "Add selected pages to list" : "Add page to list";
				});
			});
		});
	});
}

function menuButton(item, j) {
	let it = document.createElement("button");
	it.innerHTML = "<i class=\"fas fa-ellipsis-h\"></i>";
	it.title = "Menu";
	it.addEventListener("click", () => {openMenu(it, item, j);})
	return it;
}

function openMenu(self, item, j) {
	let menu = document.querySelector("#menu");
	clickedMenuButton = self;
	let vo = self.getBoundingClientRect();
	menu.style.right = (window.innerWidth - (vo.left + vo.width)) + "px";
	menu.style.bottom = "unset";
	menu.style.top = (vo.top + vo.height) + "px";
	while (menu.firstChild) {menu.removeChild(menu.firstChild);}
	chrome.runtime.getBackgroundPage((bg) => {
		if (self == document.querySelector("#topMenuButton")) {
			let clearButton = document.createElement("button");
			clearButton.innerHTML = "<i class=\"fas fa-times fa-lg fa-fw\"></i>Clear";
			clearButton.disabled = document.querySelector("#noAsides") ? true : false;
			clearButton.addEventListener("click", () => {
				if (confirm("Clear list?")) {chrome.runtime.getBackgroundPage((bg) => {bg.deleteAll();});}
			});
			menu.appendChild(clearButton);
			let optionsButton = document.createElement("button");
			optionsButton.innerHTML = "<i class=\"fas fa-cog fa-lg fa-fw\"></i>Options";
			optionsButton.addEventListener("click", () => {
				if (chrome.runtime.openOptionsPage) {
					chrome.runtime.openOptionsPage();
				} else {
					switchTo(chrome.runtime.getURL("options.html"), () => {window.close();});
				}
			});
			menu.appendChild(optionsButton);
		} else {
			let isPage = self.parentElement.parentElement.className == "pageList";
			if (bg.settings.dismiss == "yes" || (bg.settings.dismiss == "setsOnly" && !isPage)) {
				let openButton = document.createElement("button");
				openButton.innerHTML = "<i class=\"fas fa-external-link-alt fa-lg fa-fw\"></i>Open without dismissing";
				openButton.addEventListener("click", () => {
					chrome.runtime.getBackgroundPage((bg) => {
						if (isPage) {
							bg.restoreTab(bg.getIndex(item.id), j, true);
							window.close();
						} else {
							bg.restoreEntry(bg.getIndex(item.id), true);
							window.close();
						}
					});
				});
				menu.appendChild(openButton);
			}
			if (isPage) {
				let shareButton = document.createElement("button");
				shareButton.innerHTML = "<i class=\"far fa-share-square fa-lg fa-fw\"></i>Share";
				shareButton.disabled = !navigator.canShare({url: item.tabs[j].url});
				shareButton.addEventListener("click", () => {
					navigator.share({
						title: item.tabs[j].title,
						url: item.tabs[j].url
					});
				});
				menu.appendChild(shareButton);
			}
			let dismissButton = document.createElement("button");
			dismissButton.innerHTML = "<i class=\"fas fa-times fa-lg fa-fw\"></i>Dismiss";
			dismissButton.addEventListener("click", () => {
				chrome.runtime.getBackgroundPage((bg) => {
					if (isPage) {
						bg.dismissTab(bg.getIndex(item.id), j);
					} else {
						bg.dismissEntry(bg.getIndex(item.id));
					}
				});
			});
			menu.appendChild(dismissButton);
		}
		menu.show();
		if (vo.top + vo.height + menu.offsetHeight > window.innerHeight) {
			menu.style.top = "unset";
			menu.style.bottom = window.innerHeight - vo.top + "px";
		}
	});
}

function closeMenu() {
	document.querySelector("#menu").close();
	clickedMenuButton = null;
}

window.addEventListener("load", () => {
	updateAddButtons();
	chrome.tabs.onUpdated.addListener(updateAddButtons);
	load();
	chrome.runtime.onMessage.addListener((req) => {
		if (req == "dataChanged") {load();}
	});
	document.querySelector("#topMenuButton").addEventListener("click", () => {openMenu(document.querySelector("#topMenuButton"))});
	document.querySelector("#addTabButton").addEventListener("click", () => {
		chrome.runtime.getBackgroundPage((bg) => {bg.setTabs(false);});
	});
	document.querySelector("#addWindowButton").addEventListener("click", () => {
		chrome.runtime.getBackgroundPage((bg) => {bg.setTabs(true);});
	});
	document.addEventListener("click", (e) => {
		let clickedEl = e.target;
		let menu = document.querySelector("#menu");
		while (clickedEl) {
			if (clickedEl == menu) {return;}
			if (clickedMenuButton && clickedEl == clickedMenuButton) {return;}
			clickedEl = clickedEl.parentElement;
		}
		closeMenu();
	});
});

function durationText(time) {
	let units = ["year", "month", "week", "day", "hour", "minute"];
	let unitDurations = [31536000000, 2592000000, 604800000, 86400000, 3600000, 60000];
	let index = 0;
	while (index < units.length) {
		if (time >= unitDurations[index]) {break;}
		index++;
	}
	if (index == units.length) {return "a few seconds ago";}
	let number = Math.floor(time / unitDurations[index]);
	return number + " " + units[index] + ((number == 1) ? "" : "s") + " ago";
}

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