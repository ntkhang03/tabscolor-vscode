// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require("path");
const sudo = require('sudo-prompt');
const os = require("os");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

const tabsColorLog = vscode.window.createOutputChannel("Tabs Color");
let storage_ = null;

class Storage {
  constructor(context) {
    this.storage = context.globalState;
  }
  set(key, value) {
    this.storage.update(key, value);
    storage_ = this.storage;
  }

  add(key, value) {
    let data = this.storage.get(key);
    if (!data) {
      data = [];
    }
    data.push(value);
    this.set(key, data);
  }
  addTabColor(color, title) {
    let tabs = this.get("tabs");
    if (!tabs) tabs = {};
    if (!tabs[color]) {
      tabs[color] = [];
    }
    for (const i in tabs) {
      const _tabsColor = tabs[i];
      tabs[i] = _tabsColor.filter(function (a) {
        return a != title;
      });
    }
    tabs[color].push(title);
    this.set("tabs", tabs);
  }
  removeTabColor(title) {
    const tabs = this.get("tabs");
    for (const i in tabs) {
      const _tabsColor = tabs[i];
      tabs[i] = _tabsColor.filter(function (a) {
        return a != title;
      });
    }
    this.set("tabs", tabs);
  }
  addCustomColor(color) {
    const colors = this.get("customColors") || {};
    const colorName = Object.keys(color)[0];
    colors[colorName] = {
      background: color[colorName].background,
      color: color[colorName].color
    };
    this.set("customColors", colors);
  }
  removeCustomColor(colorName) {
    const colors = this.get("customColors") || {};
    delete colors[colorName];
    this.set("customColors", colors);
  }
  emptyTabs() {
    this.set("tabs", {});
  }
  get(key) {
    return this.storage.get(key);
  }
}


class Core {

  constructor(context, filePath) {
    this.context = context;
    this.fileContent = fs.readFileSync(filePath, "utf8");
    this.initialContent = this.fileContent;
    this.file = filePath;
  }
  exists() {
    return fs.existsSync(this.file);
  }
  startPatch(patchName, isReg = false) {
    let patchString = `
		/* startpatch ${patchName} */
		`;
    if (isReg) patchString = patchString.replace(/\*/g, "\\*");
    return patchString;
  }
  isReadOnly() {
    try {
      fs.writeFileSync(this.file, this.initialContent);
    }
    catch (e) {
      return true;
    }
  }
  chmod() {
    try {
      fs.chmodSync(this.file, 0o700);
    }
    catch (e) {
      console.log("Error Code:", e);
      return false;
    }
    return true;
  }
  hasPatch(patchName) {
    return this.fileContent.includes(this.startPatch(patchName));
  }
  endPatch(patchName, isReg = false) {
    let patchString = `
		/* endpatch ${patchName} */
		`;
    if (isReg) patchString = patchString.replace(/\*/g, "\\*");
    return patchString;
  }
  remove(patchName) {
    const regString = `(${this.startPatch(patchName, true)})[^]*(${this.endPatch(patchName, true)})`;
    const reg = new RegExp(regString);
    this.fileContent = this.fileContent.replace(reg, "");
    return this;
  }
  add(patchName, code) {
    const enclosedCode = `${this.startPatch(patchName)} ${code} ${this.endPatch(patchName)}`;
    this.fileContent = " " + enclosedCode + " " + this.fileContent;
    return this;
  }
  empty() {
    fs.writeFileSync(this.file, "");
    this.initialContent = "";
  }
  write() {
    console.log(this.fileContent);
    fs.writeFileSync(this.file, this.fileContent);
    this.initialContent = this.fileContent;
  }
  sudoPrompt(func) {

    const options = {
      name: 'TabsColor'
    };
    const separator = this.file.includes("/") ? "/" : "\\";
    const baseName = this.file.split(separator).reverse()[0];
    let command = `chmod 777 "${this.file}"`;
    switch (os.platform()) {
      case "win32": {
        command = `rename "${this.file}" "${baseName}"`;
      }
        break;
    }
    sudo.exec(command, options,
      function (error, stdout, stderr) {
        if (error) {
          func(false);
          throw error;
        }
        else {
          func(true);
        }
      }
    );
  }
}

function modulesPath(context) {
  return path.join(context.globalStoragePath, "modules");
}

function reloadCss() {
  vscode.window.showInformationMessage("---tab updated---");
}

function formatTitle(title) {
  if (os.platform() != "win32") {
    const homeDir = os.homedir() + '/';
    title = title.replace(homeDir, "");
  }
  return title;
}

function generateCssFile(context) {
  const colors = {
    "none": { background: "transparent", color: "inherit" },
    "salmon": { background: "#9d533a", color: "white" },
    "green": { background: "#528752", color: "white" },
    "blue": { background: "#3498DB", color: "white" },
    "orange": { background: "#DC7633", color: "white" },
    "yellow": { background: "#F1C40F", color: "black" },
    "red": { background: "#C0392B", color: "white" },
    "black": { background: "#000000", color: "white" },
    "white": { background: "#ffffff", color: "black" }
  };
  const storage = new Storage(context);
  // set all colors 
  storage.set("defaultColors", colors);
  const rulesBasedStyle = vscode.workspace.getConfiguration('tabsColor');
  const byFileType = rulesBasedStyle.byFileType;
  const byDirectory = rulesBasedStyle.byDirectory;
  const activeTab = rulesBasedStyle.activeTab;
  const cssFile = path.join(modulesPath(context), "inject.css");
  const data = "";
  const tabs = storage.get("tabs") || {};
  let style = "";
  const homeDir = os.homedir() + '/';

  for (const a in byFileType) {
    if (a == "filetype") continue;
    style += `.tab[title$=".${formatTitle(a)}" i]:not(:hover){background-color:${byFileType[a].backgroundColor} !important; opacity:${byFileType[a].opacity || "0.6"};}
				.tab[title$="${formatTitle(a)}" i]:not(:hover) a,.tab[title$="${formatTitle(a)}" i]:not(:hover) .monaco-icon-label:after,.tab[title$="${formatTitle(a)}" i]:not(:hover) .monaco-icon-label:before{color:${byFileType[a].fontColor} !important;}`;
  }
  for (const a in byDirectory) {
    if (a == "my/directory/") continue;
    const title = a.replace(/\\/g, "\\\\");
    style += `.tab[title*="${formatTitle(title)}" i]:not(:hover){background-color:${byDirectory[a].backgroundColor} !important; opacity: ${byDirectory[a].opacity || "0.6"};}
				.tab[title*="${formatTitle(title)}" i]:not(:hover) a,.tab[title*="${formatTitle(title)}" i]:not(:hover) .monaco-icon-label:after,.tab[title*="${formatTitle(title)}" i]:not(:hover) .monaco-icon-label:before{color:${byDirectory[a].fontColor} !important;}`;
  }
  style += ".tab.active{opacity:1 !important}";
  if (activeTab.backgroundColor != "default") {
    style += `body .tabs-container .tab.active:not(:hover){background-color:${activeTab.backgroundColor} !important; }body .tabs-container .tab.active:not(:hover) a,body .tabs-container .tab.active:not(:hover) .monaco-icon-label:after,body .tabs-container .tab.active:not(:hover) .monaco-icon-label:before{color:${activeTab.fontColor} !important;}`;
  }
  let activeSelectors = "";
  const activeSelectorsArr = [];
  const colorsData = { ...storage.get("customColors"), ...storage.get("defaultColors") };

  for (const i in tabs) {
    const _colorTabs = tabs[i];
    let backgroundSelectors = "";
    let fontColorSelectors = "";
    const _background = colorsData[i].background;
    const _fontColor = colorsData[i].color;
    const _opacity = colorsData[i].opacity || "0.6";
    const backgroundSelectorsArr = _colorTabs.map(function (a) {
      return `.tab[title*="${formatTitle(a)}" i]`;
    });
    activeSelectorsArr.push(..._colorTabs.map(function (a) {
      return `.tab[title*="${formatTitle(a)}" i].active`;
    }));
    const fontColorSelectorsArr = _colorTabs.map(function (a) {
      return `.tab[title*="${formatTitle(a)}" i]:not(:hover) a,.tab[title="${formatTitle(a)}" i]:not(:hover) .monaco-icon-label:after,.tab[title*="${formatTitle(a)}" i]:not(:hover) .monaco-icon-label:before`;
    });
    if (backgroundSelectorsArr.length > 0) {
      backgroundSelectors = backgroundSelectorsArr.join(",") + `{background-color:${_background} !important; opacity:${_opacity};}`;
    }

    if (fontColorSelectorsArr.length > 0) {
      fontColorSelectors = fontColorSelectorsArr.join(",") + `{color:${_fontColor} !important;}`;
    }
    style += backgroundSelectors + fontColorSelectors;
  }
  if (activeSelectorsArr.length > 0) {
    activeSelectors = activeSelectorsArr.join(",") + `{opacity:1;}`;
  }
  style += activeSelectors;
  const dirExists = fs.existsSync(modulesPath(context));
  if (!dirExists) {
    const test = fs.mkdirSync(modulesPath(context), { recursive: true });
    console.log("css", test);
  }

  console.log("file", cssFile);
  if (fs.existsSync(cssFile)) {
    fs.writeFileSync(cssFile, style);
  }
  else {
    fs.appendFile(cssFile, style, function (err) {
      if (err) {
        vscode.window
          .showInformationMessage(
            `Could not create a css file. tabscolor won't be able to change your tabs color`
          );
        throw err;
      }
    });
  }
}

function setColor(context, color, title) {
  const storage = new Storage(context);
  if (storage.get("patchedBefore")) {
    if (storage.get("secondActivation")) {
      storage.addTabColor(color, title);
      generateCssFile(context);
      reloadCss();
    } else {
      vscode.window.showErrorMessage("In order for Tabscolor to work, you need to restart your VS Code (not just reload) ");
    }
  }
  else {
    vscode.window.showErrorMessage("Tabscolor was unable to patch your VS Code files. ");
  }
}
function unsetColor(context, title) {
  const storage = new Storage(context);
  if (storage.get("patchedBefore")) {
    if (storage.get("secondActivation")) {
      storage.removeTabColor(title);
      generateCssFile(context);
      reloadCss();
    } else {
      vscode.window.showErrorMessage("In order for Tabscolor to work, you need to restart your VS Code (not just reload) ");
    }
  }
  else {
    vscode.window.showErrorMessage("Tabscolor was unable to patch your VS Code files. ");
  }
}

function promptRestart() {
  vscode.window
    .showInformationMessage(
      `Restart VS Code (not just reload) in order for tabscolor changes to take effect.`
    );
}

function promptRestartAfterUpdate() {
  vscode.window
    .showInformationMessage(
      `VS Code files change detected. Restart VS Code (not just reload) in order for tabscolor to work.`
    );
}

function activate(context) {
  const storage = new Storage(context);

  if (os.type() == "Darwin" && storage.get("mac dialog") !== true) {
    vscode.window
      .showInformationMessage("tabsColor may not work on Mac OS systems", "Don't show this again")
      .then(answer => {
        if (answer === "Don't show this again") {
          storage.set("mac dialog", true);
        }
      });
  }

  if (storage.get("deprecated dialog") == true) {
    vscode.window
      .showInformationMessage("tabsColor is Back. ", "ok")
      .then(answer => {
        if (answer === "ok") {
          storage.set("deprecated dialog", false);
        }
      });
  }
  let cssFileLink = path.join(modulesPath(context), "inject.css").replace(/\\/g, "/");
  if (os.platform() == "win32") { cssFileLink = "vscode-file://vscode-app/" + cssFileLink; }
  let bootstrapPath = path.join(path.dirname(require.main.filename), "vs/workbench/workbench.desktop.main.js");
  if (!fs.existsSync(bootstrapPath)) {
    bootstrapPath = path.join(path.dirname(require.main.filename), "bootstrap-window.js");
  }
  const bootstrap = new Core(context, bootstrapPath);
  const code = `
	function reloadCss(){
		let tabsCss=document.getElementById("tabscss");
		tabsCss.href=tabsCss.href.replace(/\\?refresh=(\\d)*/,"")+"?refresh="+Math.floor(Math.random() * 999999999999);
	}
	function createCss(){
		let head = document.getElementsByTagName('head')[0];
				let link = document.createElement('link');
				link.rel = 'stylesheet';
				link.id= 'tabscss';
				link.type = 'text/css';
				link.href = '${cssFileLink}';
				link.media = 'all';
				head.appendChild(link);
		return document.getElementById('tabscss') != null
	}
	function domInsert (element, callback=0) {
		var listen = (function(){
			var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
			return function( obj, callback ){
				if( !obj || !obj.nodeType === 1 ) return;  
				if( MutationObserver ){
					var obs = new MutationObserver(function(mutations, observer){
						callback(mutations);
					})
					obs.observe( obj, { childList:true, subtree:true });
				}
				else if( window.addEventListener ){
					obj.addEventListener('DOMNodeInserted', callback, false);
				}
			}
		})();
		let listElm = element;
		listen( listElm, function(m){ 
			var addedNodes = []
			m.forEach(record => record.addedNodes.length & addedNodes.push(...record.addedNodes))
			if(callback!=0)
				callback(addedNodes);
		});
	};
	
	document.addEventListener('readystatechange', function(){
		if(document.readyState=="complete"){
		setTimeout(function(){
			domInsert(document, function(appeared){
				let updatePopup = appeared.filter(function(a){
					return a.textContent.trim().includes("---tab updated---");
				})
				if(updatePopup.length>0){
					updatePopup.forEach(function(a){
						if(updatePopup && typeof updatePopup!="string"){
							if(a.classList && !a.classList.contains("notifications-toasts"))
								a.remove();
						}
					})
					reloadCss();
				}
				
			})
		},1000)
		var cssCreateProc = setInterval(function(){
			if(createCss()){
				clearInterval(cssCreateProc);
			}
		},500);
	}
	});
	`;

  if (!bootstrap.hasPatch("watcher")) {
    vscode.window
      .showInformationMessage(`After restart you may get the message "Your Code installation is corrupt..." click on the gear icon and choose "don't show again" `);

    if (bootstrap.isReadOnly() && !bootstrap.chmod()) {
      bootstrap.sudoPrompt(function (result) {
        if (result) {
          bootstrap.add("watcher", code).write();
          if (storage.get("patchedBefore")) {
            storage.set("secondActivation", false);
            storage.set("firstActivation", false);
            promptRestartAfterUpdate();
          }
          else {
            storage.set("patchedBefore", true);
            promptRestart();
          }
        } else {
          vscode.window.showErrorMessage("Tabscolor was unable to write to " + bootstrap.file);
        }
      });
    }
    else {
      bootstrap.add("watcher", code).write();
      if (storage.get("patchedBefore")) {
        storage.set("firstActivation", false);
        storage.set("secondActivation", false);
        promptRestartAfterUpdate();
      }
      else {
        storage.set("patchedBefore", true);
        promptRestart();
      }
    }
  }
  else {
    storage.set("patchedBefore", true);
    storage.set("firstActivation", true);
  }
  if (storage.get("firstActivation")) {

    generateCssFile(context);
    reloadCss();
    storage.set("secondActivation", true);
  }
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('tabsColor')) {
      vscode.window.showInformationMessage('tabs colors updated');
      generateCssFile(context);
      reloadCss();
    }
  });

  storage.set("firstActivation", true);


  let disposable = vscode.commands.registerCommand('tabscolor.test', function () {
    console.log("test begin");
    bootstrap.remove("watcher").add("watcher", code).write();
    // bootstrap.sudoPrompt(function(result){})
  });

  disposable = vscode.commands.registerCommand('tabscolor.locateTargetFile', function () {
    // Display the stored tabs colors in console
    console.log("bootstrap file :" + bootstrapPath);
    vscode.window.showInformationMessage(bootstrapPath);
  });

  disposable = vscode.commands.registerCommand('tabscolor.debugMac', function () {
    const options = {
      name: 'TabsColor'
    };

    vscode.window.showInformationMessage("trying to allow editing of Bootstrap file. Check vs code console for messages ");
    console.log("Tabscolor: Trying to allow editing of Bootstrap file");
    const separator = bootstrapPath.includes("/") ? "/" : "\\";
    const baseName = bootstrapPath.split(separator).reverse()[0];
    // Find the right command to allow editing of Bootstrap file on MAC
    // var command=`chmod 777 "${bootstrapPath}"`
    const command = `chmod a+w "${bootstrapPath}"`;
    console.log("Tabscolor: command : " + command);
    sudo.exec(command, options,
      function (error, stdout, stderr) {
        if (error) {

          vscode.window.showInformationMessage("command failed");
          console.error("tabsColor:" + error);
          throw error;
        }
        else {
          vscode.window.showInformationMessage("command executed successfully. Bootstrap file should be able to get patched now");
          console.log("Tabscolor: command executed successfully. Bootstrap file should be able to get patched now ");
        }
      }
    );
  });

  disposable = vscode.commands.registerCommand('tabscolor.clearTabsColors', function () {
    const cssFile = path.join(modulesPath(context), "inject.css").replace(/\\/g, "/");
    const css = new Core(context, cssFile);
    storage.emptyTabs();
    css.empty();
    generateCssFile(context);
    reloadCss();
    vscode.window.showInformationMessage('tabs colors cleared. rules based on filetype and directories aren\'t affected ');
  });


  disposable = vscode.commands.registerCommand('tabscolor.debugColors', function () {
    // Display the stored tabs colors in console
    console.log(storage.get("tabs"));
  });

  disposable = vscode.commands.registerCommand('tabscolor.debugEraseStorage', function () {
    storage.set("firstActivation", false);
    storage.set("secondActivation", false);
    storage.set("patchedBefore", false);
  });



  disposable = vscode.commands.registerCommand('tabscolor.none', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    unsetColor(context, file.replace(/\\/g, "\\\\"));
  });


  disposable = vscode.commands.registerCommand('tabscolor.repatch', function (a, b) {
    bootstrap.remove("watcher").add("watcher", code).write();
    promptRestart();
  });


  disposable = vscode.commands.registerCommand('tabscolor.removePatch', function (a, b) {
    bootstrap.remove("watcher").write();
    promptRestart();
  });


  disposable = vscode.commands.registerCommand('tabscolor.salmon', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "salmon", file.replace(/\\/g, "\\\\"));
  });


  disposable = vscode.commands.registerCommand('tabscolor.green', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "green", file.replace(/\\/g, "\\\\"));

  });

  disposable = vscode.commands.registerCommand('tabscolor.blue', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "blue", file.replace(/\\/g, "\\\\"));

  });

  disposable = vscode.commands.registerCommand('tabscolor.red', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "red", file.replace(/\\/g, "\\\\"));

  });

  disposable = vscode.commands.registerCommand('tabscolor.orange', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "orange", file.replace(/\\/g, "\\\\"));

  });
  disposable = vscode.commands.registerCommand('tabscolor.yellow', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "yellow", file.replace(/\\/g, "\\\\"));

  });
  disposable = vscode.commands.registerCommand('tabscolor.black', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "black", file.replace(/\\/g, "\\\\"));

  });
  disposable = vscode.commands.registerCommand('tabscolor.white', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    setColor(context, "white", file.replace(/\\/g, "\\\\"));

  });
  disposable = vscode.commands.registerCommand('tabscolor.randomColor', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    if (a) file = a.fsPath;
    const colorNames = Object.keys({ ...storage.get("customColors"), ...storage.get("defaultColors") });
    let colorName;
    do {
      colorName = colorNames[Math.floor(Math.random() * colorNames.length)];
    }
    while (colorName === "none");
    vscode.window.showInformationMessage(`random color "${colorName}" set to current file`);
    setColor(context, colorName, file.replace(/\\/g, "\\\\"));

  });
  disposable = vscode.commands.registerCommand('tabscolor.more', function (a, b) {
    const customColors = storage.get("customColors") || {};
    if (!Object.keys(customColors).length)
      return vscode.window.showWarningMessage("No more colors, add some first");

    // create  options for user to choose from
    const options = {
      placeHolder: "Choose color (click escape to cancel)",
      matchOnDescription: true,
      matchOnDetail: true,
      ignoreFocusOut: true,
      canPickMany: false
    };
    vscode.window.showQuickPick(
      Object.keys(customColors).map(c => ({
        label: c,
        description: `background: ${customColors[c].background}, color: ${customColors[c].color}`,
      }), options)
    ).then(color => {
      if (!color)
        return;
      let file = vscode.window.activeTextEditor?.document.fileName;
      if (a) file = a.fsPath;
      setColor(context, color.label, file.replace(/\\/g, "\\\\"));
    });
  });


  // add color commands
  disposable = vscode.commands.registerCommand('tabscolor.addColor', function (a, b) {
    let file = vscode.window.activeTextEditor?.document.fileName;
    const allColors = { ...storage.get("customColors"), ...storage.get("defaultColors") };
    // Create a new webview panel
    const panel = vscode.window.createWebviewPanel(
      'colorPicker', // Identifier for the webview panel
      'Color Picker', // Title for the webview panel
      vscode.ViewColumn.One, // Column in which to show the webview panel
      {
        enableScripts: true,
        retainContextWhenHidden: true
      } // Webview panel options
    );

    // Generate the HTML for a table of colors
    const html = `
				<style>
					button {
						background-color: rgb(29 144 211);
						border-radius: 8px;
						border-width: 0;
						color: #ffffff;
						cursor: pointer;
						display: inline-block;
						font-family: "Haas Grot Text R Web", "Helvetica Neue", Helvetica, Arial, sans-serif;
						font-size: 14px;
						font-weight: 500;
						line-height: 20px;
						list-style: none;
						padding: 7px 12px;
						text-align: center;
						transition: all 200ms;
						vertical-align: baseline;
						white-space: nowrap;
						user-select: none;
						-webkit-user-select: none;
						touch-action: manipulation;
					}

					.error_message {
						margin-bottom: 3px;
						argin: 10px 0;
						padding: 10px;
						border-radius: 3px 3px 3px 3px;
						display: none;
						color: white;
						width: 200px;
						align-items: center;
						background-color: rgba(248, 215, 218, 1);
						border-color: rgba(220, 53, 69, 1);
						color: rgba(114, 28, 36,1);
						transition: all 0.5s;
					}

					button:hover {
						opacity: 0.8;
					}

					.area {
						margin-top: 26px;
					}
				</style>

				<!-- Because the color picker will cover the preview if put it below, so I put it at the top -->

				<div class="area">
					<p>Preview Color</p>
					<div style="display: flex; flex-direction: row; ">
						<div class="preview-f" style="width: 200px; height: 37px; background-color: #fe39c9; color: #fff; display: flex; justify-content: center; align-items: center; margin-right: 2px;">
							<p>focuse</p>
						</div>
						
						<div class="preview-uf" style="width: 200px; height: 37px; background-color: #fe39c9; color: #fff; display: flex; justify-content: center; align-items: center; opacity: 0.6;">
							<p>unfocuse</p>
						</div>
					</div>
				</div>

				<div class="area">
					<p>Color Name</p>
					<div id="errorName" class="error_message"></div>
					<input type="text" id="colorName" style="height: 24px; width: 213px;"/>
				</div>

				<div class="area">
					<p>Background Color (hex color or rgb)</p>
					<div id="errorBackground" class="error_message"></div>
					<div style="display: flex; flex-direction: row;">
						<input type="color" id="colorBackground" value="#fe39c9"/>
						<input type="input" id="colorBackgroundInput" value="#fe39c9"/>
					</div>
				</div>

				<div class="area">
					<p>Text Color (hex color or rgb)</p>
					<div id="errorText" class="error_message"></div>
					<div style="display: flex; flex-direction: row;">
						<input type="color" id="colorText" value="#ffffff"/>
						<input type="input" id="colorTextInput" value="#ffffff"/>
					</div>
				</div>

				<div class="area">
					<p>Opacity (color when tab is not active, choose from 0 to 1)</p>
					<div id="errorOpacity" class="error_message"></div>
					<input type="number" id="colorOpacity" value="0.6" min="0" max="1" step="0.1" style="height: 24px; width: 213px;"/>
				</div>
				
				
				<div class="area">
					<div id="errorSubmit" class="error_message"></div>
					<button id="submit" style="width: 100px; margin-right: 10px;">Submit</button>
					<button id="close" style="width: 100px; margin-left: 10px; background-color: #ff5959;">Close</button>
				</div>


				<script>
					function componentToHex(c) {
						var hex = c.toString(16);
						return hex.length == 1 ? "0" + hex : hex;
					}
					
					function rgbToHex(r, g, b) {
						return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
					}

					function handlePreview(id, color) {
						const type = id == "colorBackground" ? 'background-color' : 'color';
						document.querySelector('#' + id + 'Input').value = color;
						hideErrorMessage(id == "colorBackground" ? 'errorBackground' : 'errorText')
						const previewF = document.querySelector('.preview-f');
						const previewUF = document.querySelector('.preview-uf');
						previewF.style[type] = color;
						previewUF.style[type] = color;
						previewUF.style.opacity = 0.6;
					}

					function colorValidationHex(color) {
						return color.match(/^#[0-9a-f]{6}\$/i);
					}

					function colorValidationRgb(color) {
						return color.match(/^rgb\\((0|255|25[0-4]|2[0-4]\\d|1\\d\\d|0?\\d?\\d),(0|255|25[0-4]|2[0-4]\\d|1\\d\\d|0?\\d?\\d),(0|255|25[0-4]|2[0-4]\\d|1\\d\\d|0?\\d?\\d)\\)\$/);
					}

					function showErrorMessage(id, message) {
						const el = document.getElementById(id);
						el.innerText = message;
						el.style.display = 'block';
					}

					function hideErrorMessage(id) {
						const el = document.getElementById(id);
						el.style.display = 'none';
					}

					function checkErrorSubmit() {
						const allErrors = document.querySelectorAll('.error_message');
						for (let i = 0; i < allErrors.length; i++) {
							if (allErrors[i].style.display == 'block' && allErrors[i].id != "errorSubmit")
								return true;
						}
						hideErrorMessage('errorSubmit');
						return false;
					}
				
					const vscode = acquireVsCodeApi();
					const form = document.querySelector('form');
					const colorName = document.querySelector('#colorName');
					const colorBackground = document.querySelector('#colorBackground');
					const colorText = document.querySelector('#colorText');

					const colorBackgroundInput = document.querySelector('#colorBackgroundInput');
					const colorTextInput = document.querySelector('#colorTextInput');
					const colorOpacity = document.querySelector('#colorOpacity');
					const submit = document.querySelector('#submit');
					const close = document.querySelector('#close');

					const allColors = ${JSON.stringify(allColors)};
					
					showErrorMessage('errorName', "! Color name is required");
					colorName.addEventListener('input', () => {
						if (allColors[colorName.value?.trim()]) {
							const htmlError = "! Color name already exists";
							showErrorMessage('errorName', htmlError);
						}
						else if (!colorName.value?.trim()) {
							const htmlError = "! Color name is required";
							showErrorMessage('errorName', htmlError);
						}
						else {
							hideErrorMessage('errorName');
						}
						checkErrorSubmit();
					});

					[colorBackground, colorText].forEach((input) => {
						input.addEventListener('input', (e) => {
							handlePreview(e.target.id, e.target.value);
						});
					});

					[colorBackgroundInput, colorTextInput].forEach((input) => {
						input.addEventListener('input', (e) => {
							let value = e.target.value || '';

							const elChange = e.target.id === 'colorBackgroundInput' ? colorBackground : colorText;
							const idMessageError = input.id === 'colorBackgroundInput' ? 'errorBackground' : 'errorText';

							if (colorValidationRgb(value)) {
								value = rgbToHex(...colorValidationRgb(value).slice(1).map((v) => parseInt(v)));
								elChange.value = value;
								input.value = value;
							}
							else if (colorValidationHex(value)) {
								elChange.value = value;
							}
							else {
								const errorMessage = "! Invalid color, please enter a valid color in hex or rgb format";
								return showErrorMessage(idMessageError, errorMessage);
							}

							checkErrorSubmit();
							hideErrorMessage(idMessageError);
							handlePreview(elChange.id, elChange.value);
						});
					});

					colorOpacity.addEventListener('input', (e) => {
						if (!e.target.value || e.target.value < 0 || e.target.value > 1) {
							return showErrorMessage('errorOpacity', "! Opacity must be between 0 and 1");
						}
						else {
							hideErrorMessage('errorOpacity');
							const previewUF = document.querySelector('.preview-uf');
							previewUF.style.opacity = e.target.value;
						}
						checkErrorSubmit();
					});

					submit.addEventListener('click', () => {
						const errorElements = document.querySelectorAll('[id^="error"]');
						for (const el of errorElements) {
							if (el.style.display == 'block')
								return showErrorMessage('errorSubmit', "! Please fill in all fields correctly");
						}

						if (!colorName.value || !colorBackground.value || !colorText.value || !colorValidationHex(colorBackground.value) || !colorValidationHex(colorText.value)) {
							return showErrorMessage('errorSubmit', "! Please fill in all fields correctly");
						}
						else if (allColors[colorName.value]) {
							showErrorMessage('errorName', "! Color name already exists");
						}
						else {
							allColors[colorName.value] = {
								background: colorBackground.value,
								color: colorText.value
							};
							return vscode.postMessage({
								command: 'addColor',
								colorName: colorName.value.trim(),
								colorBackground: colorBackground.value.trim(),
								colorText: colorText.value.trim(),
								colorOpacity: colorOpacity.value.trim(),
							});
						}
					});

					close.addEventListener('click', () => {
						vscode.postMessage({
							command: 'close'
						});
					});
				</script>
			`;
    // Set the webview's initial html content
    panel.webview.html = html;

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'addColor': {
            if (!message.colorName?.trim() || !message.colorBackground || !message.colorText)
              return vscode.window.showErrorMessage('Please fill in all fields correctly');
            if (allColors[message.colorName])
              return vscode.window.showErrorMessage(`Color "${message.colorName}" already exists`);
            const newColor = {
              [message.colorName]: {
                background: message.colorBackground,
                color: message.colorText
              }
            };
            if (message.colorOpacity != 0.6)
              newColor[message.colorName].opacity = message.colorOpacity;
            storage.addCustomColor(newColor);
            allColors[message.colorName] = {
              background: message.colorBackground,
              color: message.colorText
            };
            setColor(context, message.colorName, file.replace(/\\/g, "\\\\"));
            vscode.window.showInformationMessage(`Color "${message.colorName}" added`);
            return;
          }
          case 'error': {
            vscode.window.showErrorMessage(message.message);
            return;
          }
          case 'close': {
            panel.dispose();
            return;
          }
        }
      },
      undefined,
      context.subscriptions
    );
  });

  // delete color commands
  disposable = vscode.commands.registerCommand('tabscolor.deleteCustomColor', () => {
    const customColors = storage.get("customColors") || {};
    const tabs = storage.get("tabs") || {};
    if (Object.keys(customColors).length === 0)
      return vscode.window.showWarningMessage("No custom colors to delete");
    const colorNames = Object.keys(customColors);
    vscode.window.showQuickPick(colorNames, { canPickMany: true }).then((colorNames) => {
      if (!colorNames)
        return;
      colorNames.forEach((colorName) => {
        const allColorTabs = Object.keys(tabs);
        const hasUseThisColor = allColorTabs.includes(colorName);
        let countFiles = 0;

        if (hasUseThisColor) {
          tabs[colorName].forEach((file) => {
            countFiles++;
            unsetColor(context, file.replace(/\\/g, "\\\\"));
          });
          delete tabs[colorName];
          storage.set("tabs", tabs);
        }


        delete customColors[colorName];

        storage.set("customColors", customColors);
        vscode.window.showInformationMessage(`Deleted color "${colorName}"${countFiles ? ` and removed from ${countFiles} tabs` : ""}`);
      });
    });
  });



  context.subscriptions.push(disposable);
}

// when deactivate (reload window), value of context is undefined
function deactivate(context) {
  const bootstrapPath = path.join(path.dirname(require.main.filename), "bootstrap-window.js");
  const bootstrap = new Core(context, bootstrapPath);
  if (context) {
    const storage = new Storage(context);
    storage.set("firstActivation", false);
    storage.set("secondActivation", false);
  }
  else {
    storage_.update("firstActivation", false);
    storage_.update("secondActivation", false);
  }
  bootstrap.remove("watcher").write();
}

module.exports = {
  activate,
  deactivate
};
