//----------------------------------------------------------
// IMPORTS
//----------------------------------------------------------
import { open                             } from '@tauri-apps/api/dialog'
import { appConfigDir                     } from '@tauri-apps/api/path'
import { writeFile, readTextFile, exists  } from '@tauri-apps/api/fs'
import { invoke                           } from '@tauri-apps/api'


//----------------------------------------------------------
// GLOBALS
//----------------------------------------------------------
let toolExe       : null | string | string[]
let executeButton : HTMLButtonElement
let saveButton    : HTMLButtonElement
let reloadButton  : HTMLButtonElement
let clearButton   : HTMLButtonElement
let toolSelect    : HTMLInputElement
let toolPath      : HTMLInputElement
let toolTip       : HTMLSpanElement
let modeSelect    : HTMLSelectElement
let inputs        : HTMLDivElement
let config        : any = {}
let elements      : any[] = []
let commands      : any
let tooltips      : any
let commandList   : any
let outputArea    : HTMLTextAreaElement

let $  = document.querySelector   .bind(document)
let $$ = document.querySelectorAll.bind(document)


//----------------------------------------------------------
// DOM CONTENT LOADED
//----------------------------------------------------------
window.addEventListener(`DOMContentLoaded`, () => {
  Initialize()
});


//----------------------------------------------------------
// INITIALIZE
//----------------------------------------------------------
let Initialize = () => {

  outputArea      = $(`#output`    ) as HTMLTextAreaElement

  L(`🎌 Initializing..`)

  toolPath        = $(`#toolPath`  ) as HTMLInputElement
  toolSelect      = $(`#toolSelect`) as HTMLInputElement
  modeSelect      = $(`#mode`      ) as HTMLSelectElement
  saveButton      = $(`#save`      ) as HTMLButtonElement
  reloadButton    = $(`#reload`    ) as HTMLButtonElement
  clearButton     = $(`#clear`     ) as HTMLButtonElement
  executeButton   = $(`#execute`   ) as HTMLButtonElement
  inputs          = $(`#inputs`    ) as HTMLDivElement

  elements.push($$(`.disableable`))
  executeButton.classList.add(`tooltip`)

  saveButton   .addEventListener(`click`, SaveConfig)
  reloadButton .addEventListener(`click`, ReloadConfig)
  clearButton  .addEventListener(`click`, ClearConfig)
  executeButton.addEventListener(`click`, ExecuteCommand)
  toolSelect   .addEventListener(`click`, SelectTool)
  modeSelect   .addEventListener(`change`, ModeUpdated)

  commands = GetCommands()
  tooltips = GetTooltips()

  CreateModeSelectionMenu()
  LoadSettings()
}


//----------------------------------------------------------
// CREATE MODE SELECTION MENU
//----------------------------------------------------------
let CreateModeSelectionMenu = () => {
  for (let key in commands) {
    if (String(key) == `common`) continue;
    let option = document.createElement(`option`)
    option.setAttribute(`value`, Capitalize(key))
    option.innerHTML = GetDisplayString(key)
    modeSelect.appendChild(option)
  }
}


//----------------------------------------------------------
// LOAD SETTINGS
//----------------------------------------------------------
let LoadSettings = async () => {
  let result = await exists(String(`bpt-config.json`))

  L(`🔎 Searching for previous configuration settings..`)

  if (result) {
    
    L(`⌛ Config found and loaded!`)
    
    config             = JSON.parse(await readTextFile(`bpt-config.json`));
    toolPath.innerHTML = config.toolExe || ``
    toolExe            = config.toolExe

    modeSelect.value = config.mode || ``
    ModeUpdated();

    if (!await exists(String(toolExe))) toolExe = null
    ToolExeUpdated()

    return
  }

  L(`❌ No configuration file found.`)
  L(`🧻 Creating new config file..`)

  ModeUpdated();

  await SelectTool()
  
  toolPath.value = String(toolExe)
  AppendConfig({ toolExe })
  
  modeSelect.value = config.mode || ``
  ModeUpdated();

  L(`✅ New config file created!`)
}


//----------------------------------------------------------
// SELECT TOOL
//----------------------------------------------------------
let SelectTool = async () => {
  toolExe = await open({
    directory: false,
    filters: [{
      name: `Build Patch Tool`,
      extensions: [`exe`]
    }],
    defaultPath: await appConfigDir(),
  })

  if (toolExe == null) {
    let result = await exists(String(toolPath.innerHTML));
    if (result) toolExe = config.toolExe
  } else {
    config == toolExe
  }

  ToolExeUpdated();
}


//----------------------------------------------------------
// TOOL EXE UPDATED
//----------------------------------------------------------
let ToolExeUpdated = async () => {
  if (toolExe) {

    toolPath.innerHTML = String(toolExe)
    AppendConfig({ toolExe })
    await writeFile(`bpt-config.json`, JSON.stringify( config ));

    if (modeSelect.value == ``) {
      modeSelect.disabled = false
      return
    }

    DisableElements(false)
    executeButton.classList.remove(`tooltip`)
    return
  }

  toolPath.innerHTML = `&nbsp;`
  DisableElements(true)
  toolSelect.disabled = false
}


//----------------------------------------------------------
// MODE UPDATED
//----------------------------------------------------------
let ModeUpdated = () => {
  UpdateCommandList()
  AppendConfig({ mode: modeSelect.value })
  CreateInputs()
}


//----------------------------------------------------------
// UPDATE COMMAND LIST
//----------------------------------------------------------
let UpdateCommandList = () => {
  executeButton.disabled = false
  commandList = commands.common

  switch (modeSelect.value) {
    case `CopyBinary`    : commandList = commands.copyBinary;    break;
    case `DeleteBinary`  : commandList = commands.deleteBinary;  break;
    case `DeltaPatch`    : commandList = commands.deltaPatch;    break;
    case `DiffBinaries`  : commandList = commands.diffBinaries;  break;
    case `LabelBinary`   : commandList = commands.labelBinary;   break;
    case `ListBinaries`  : commandList = commands.listBinaries;  break;
    case `UnlabelBinary` : commandList = commands.unlabelBinary; break;
    case `UploadBinary`  : commandList = commands.uploadBinary;  break;
    default              : executeButton.disabled = true
  }

  commandList = Object.assign({}, commands.common, commandList)
}


//----------------------------------------------------------
// CREATE INPUTS
//----------------------------------------------------------
let CreateInputs = () => {
  while (inputs.firstChild) {
    inputs.removeChild(inputs.firstChild)
  }

  for (let key in commandList) {
    const p     = document.createElement(`p`)
    const input = document.createElement(`input`)

    p.appendChild(input)

    AddTip(p, key)

    let type

    switch (commandList[key].type) {
      case `pwd`: type = `password`; AddPasswordToggle(p); break;
      case `val`: type = `text`;        break;
      case `num`: type = `number`;      break;
      case `exe`: type = `text`;        break; // TODO: add event listener
      case `txt`: type = `text`;        break; // TODO: add event listener
      default: type = `text`
    }

    input.setAttribute(`required`, commandList[key].required)
    input.setAttribute(`type`, type)
    input.setAttribute(`id`, key)
    input.setAttribute(`placeholder`, GetDisplayString(key));
    input.classList.add(`disableable`)
    input.value = config[key] || ``;
    input.addEventListener(`focusout`, UpdateConfig)
    inputs.appendChild(p)
  }

  elements = []
  elements.push($$(`.disableable`))

  const toggleButtons = $$(`.pass`)
  toggleButtons.forEach(button => { button.addEventListener(`mousedown`, function (this: HTMLElement) { ToggleVisibility(this)})})
  toggleButtons.forEach(button => { button.addEventListener(`mouseup`,   function (this: HTMLElement) { ToggleVisibility(this)})})
}


//----------------------------------------------------------
// UPDATE CONFIG
//----------------------------------------------------------
function UpdateConfig(this: HTMLInputElement) {
  config[this.getAttribute(`id`)!] = this.value
}


//----------------------------------------------------------
// APPEND CONFIG
//----------------------------------------------------------
let AppendConfig = (newConfig : {}) => {
  config = Object.assign({}, config, newConfig)
}


//----------------------------------------------------------
// SAVE CONFIG
//----------------------------------------------------------
let SaveConfig = async () => {
  
  ResetOutput()

  try {
    await writeFile(`bpt-config.json`, JSON.stringify(config))
    L(`🥳Configuration saved!`)
  } catch (e) {
    L(`${e}`)
  }
} 


//----------------------------------------------------------
// RELOAD CONFIG
//----------------------------------------------------------
let ReloadConfig = async () => {
  ResetOutput()
  LoadSettings()
}


//----------------------------------------------------------
// CLEAR CONFIG
//----------------------------------------------------------
let ClearConfig = async () => {
  config = { toolExe: config.toolExe }
  modeSelect.value = ``
  executeButton.classList.add(`tooltip`)
  L(`🧹 Configuration cleared!`)
  UpdateCommandList()
  CreateInputs()
}


//----------------------------------------------------------
// ADD PASSWORD TOGGLE
//----------------------------------------------------------
let AddPasswordToggle = (p: HTMLElement) => {
  const eye = document.createElement(`i`)
  eye.classList.add(`bi`)
  eye.classList.add(`bi-eye-slash-fill`)
  eye.classList.add(`pass`)
  p.appendChild(eye)
}


//----------------------------------------------------------
// ADD TIP
//----------------------------------------------------------
let AddTip = (p: HTMLElement, key: any) => {
  document.createElement(`i`)
  const tip = document.createElement(`i`)
  tip.setAttribute(`data-tip`, tooltips[Capitalize(key)])
  tip.classList.add(`bi`)
  tip.classList.add(`bi-info-square`)
  tip.addEventListener(`mouseover`, ToggleTooltip)
  tip.addEventListener(`mouseout`, ToggleTooltip)
  p.appendChild(tip)
}


//----------------------------------------------------------
// SHOW TOOLTIP
//----------------------------------------------------------
function ToggleTooltip(this: HTMLElement, event: MouseEvent) {
  if (event.type == "mouseover") {
    toolTip = document.createElement('span')
    toolTip.classList.add(`tip`)
    toolTip.innerHTML = String(this.getAttribute("data-tip"))
    this.parentElement!.appendChild(toolTip)
    return
  }

  this.parentElement!.removeChild(toolTip)
}


//----------------------------------------------------------
// GET DISPLAY STRING
//----------------------------------------------------------
let GetDisplayString = (key: string) => {
  const pattern = /([A-Z])/g;
  return Capitalize(key).replace(pattern, ` $1`).trim()
}


//----------------------------------------------------------
// CAPITALIZE
//----------------------------------------------------------
let Capitalize = (key: string) => {
  return key.charAt(0).toUpperCase() + key.slice(1)
}


//----------------------------------------------------------
// DISABLE ELEMENTS
//----------------------------------------------------------
let DisableElements = (disable: boolean) => {
  for (let i = 0; i < elements.length; i++)
    for (let j = 0; j < elements[i].length; j++)
      elements[i][j].disabled = disable;
}


//----------------------------------------------------------
// TOGGLE PASSWORD VISIBILITY
//----------------------------------------------------------
let ToggleVisibility = (button : HTMLElement) => {
  const field = button.previousElementSibling?.previousElementSibling as HTMLInputElement
  field.type = field.type === `password` ? `text` : `password`;
  button.classList.toggle(`bi-eye-slash-fill`);
  button.classList.toggle(`bi-eye-fill`);
}


//----------------------------------------------------------
// EXECUTE COMMAND
//----------------------------------------------------------
let ExecuteCommand = async () =>  {
  DisableElements(true)

  const { command, valid, newConfigObject } = BuildCommand()

  if (!valid) {
    DisableElements(false)
    ResetOutput()
    L(`${String(command)}`)
    return;
  }

  let result = await invoke(`run_command`, { command })

  ResetOutput()
  L(String(result))

  DisableElements(false)
  AppendConfig(newConfigObject)
}


//----------------------------------------------------------
// BUILD COMMAND
//----------------------------------------------------------
let BuildCommand = () : { command: string, valid: boolean, newConfigObject: { } } => {

  let newConfigObject = { toolExe, mode: modeSelect.value }
  let command         = `${toolExe} -mode=${modeSelect.value}`;

  for (let key in commandList) {
    let value = ($(`#${key}`) as HTMLInputElement).value

    if (commandList[key].required && !value) 
      return { command: `❌${GetDisplayString(key)} was required but no value was provided!`, valid: false, newConfigObject }
    
    command += ` -${key}=${($(`#${key}`) as HTMLInputElement).value}`

    let newEntry: any = { }
    newEntry[key] = value

    newConfigObject = Object.assign({}, newConfigObject, newEntry)
  }

  return { command, valid: true, newConfigObject };
}


//----------------------------------------------------------
// LOG
//----------------------------------------------------------
let L =(message: string) => {
  outputArea.value += `\n\n${message}`; 
}


//----------------------------------------------------------
// RESET OUTPUT
//----------------------------------------------------------
let ResetOutput = () => {
  outputArea.value = `💩 made with Bry 💖`
}


//----------------------------------------------------------
// GET TOOLTIPS
//----------------------------------------------------------
let GetCommands = () => {
  return {
    "common" : {
        "organizationId"        : { "required": true,   "type": "pwd" },
        "productId"             : { "required": true,   "type": "pwd" }, 
        "artifactId"            : { "required": true,   "type": "pwd" },
        "clientId"              : { "required": true,   "type": "pwd" },
        "clientSecret"          : { "required": true,   "type": "pwd" }
    },

    "copyBinary" : {
        "buildVersion"          : { "required": true,   "type": "val" },
        "sourceArtifactId"      : { "required": true,   "type": "pwd" }, 
        "destArtifactId"        : { "required": true,   "type": "pwd" }
    },

    "deleteBinary" : {
      "buildVersion"            : { "required": true,   "type": "val" },
    },

    "deltaPatch" : {
        "cloudDir"              : { "required": true,   "type": "dir" },
        "buildVersionA"         : { "required": true,   "type": "val" }, 
        "buildVersionB"         : { "required": true,   "type": "val" },
        "diffAbortThreshold"    : { "required": false,  "type": "num" }
    },

    "diffBinaries" : {
        "buildVersionA"         : { "required": true,   "type": "val" },
        "buildVersionB"         : { "required": true,   "type": "val" }, 
        "installTagsA"          : { "required": false,  "type": "val" },
        "installTagsB"          : { "required": false,  "type": "val" },
        "compareTagSet"         : { "required": false,  "type": "val" },
        "outputFile"            : { "required": false,  "type": "out" }
    },

    "labelBinary" : {
        "buildVersion"          : { "required": true,   "type": "val" },
        "label"                 : { "required": true,   "type": "lbl" }, 
        "platform"              : { "required": true,   "type": "plt" },
        "sandboxId"             : { "required": true,   "type": "val" }
    },

    "listBinaries" : {
        "onlyLabeled"           : { "required": false,  "type": "bol"  },
        "num"                   : { "required": false,  "type": "num"  }, 
        "outputFile"            : { "required": false,  "type": "out"  },
        "sandboxId"             : { "required": true,   "type": "val"  }
    },

    "unlabelBinary" : {
        "buildVersion"          : { "required": true,   "type": "val"  },
        "label"                 : { "required": true,   "type": "lbl"  }, 
        "platform"              : { "required": true,   "type": "plt"  },
        "sandboxId"             : { "required": true,   "type": "pwd"  }
    },

    "uploadBinary" : {
        "buildRoot"             : { "required": true,   "type": "dir" },
        "cloudDir"              : { "required": true,   "type": "dir" }, 
        "buildVersion"          : { "required": true,   "type": "val" },
        "appLaunch"             : { "required": true,   "type": "exe" },
        "appArgs"               : { "required": false,  "type": "val" },
        "fileList"              : { "required": false,  "type": "txt" },
        "fileAttributeList"     : { "required": false,  "type": "txt" },
        "fileIgnoreList"        : { "required": false,  "type": "txt" }
    }
  }
}


//----------------------------------------------------------
// GET COMMANDS
//----------------------------------------------------------
let GetTooltips = () => {
  return {
      "AppArgs"            : "The commandline to send to the app on launch. This can be set to “” when no additional arguments are needed.",
      "AppLaunch"          : "The path to the app executable that should be launched when running your game, relative to (and inside of) the BuildRoot. <br><br>For Mac binaries, this should be the executable file contained within the .app folder, usually in the location Game.app/Contents/MacOS/Game.",
      "ArtifactId"         : "Specify the Artifact ID string that was provided along with your credentials.",
      "BuildRoot"          : "The path to the directory containing the binary to be read and processed. It can be an absolute path from the drive root or a relative path from the current working directory. <br><br>Additionally, it is recommended that this path be located near the drive root, to avoid any files exceeding the OS MAX_PATH limit (typically 260 characters).",
      "BuildVersion"       : "The version string for the build. This needs to be unique for each build of a specific artifact, independent of platform. <br><br>For example, BuildVersion-1.0 can only exists for Windows or Mac, not both. <br><br>The build version string has the following restrictions: <br><br>• Must be between 1 and 100 chars in length <br>• No whitespaces <br>• Only contains a-z, A-Z, 0-9, or .+-_",
      "BuildVersionA"      : "The version string for the base binary image.",
      "BuildVersionB"      : "The version string for the binary image to be updated.",
      "ClientId"           : "Available in the Dev Portal under Your Product > Product Settings > General tab > Build Patch Tool Credentials.",
      "ClientSecret"       : "Available in the Dev Portal under Your Product > Product Settings > General tab > Build Patch Tool Credentials.",
      "CloudDir"           : "A directory where BuildPatchTool can save files to be uploaded, this can be empty each run. As with the BuildRoot, this can be an absolute or a relative path. <br><br>This location is used to cache information about existing binaries, and should be a different directory from the BuildRoot parameter. <br><br>It is OK if this directory is initially empty; BuildPatchTool will download information as needed from the Epic backend and store it in the CloudDir.)",
      "CompareTagSet"      : "Specifies in quotes a comma separated list of install tags used to calculate differential statistics between the binaries. Multiple lists are allowed. Same rules apply as InstallTagsA.",
      "DestArtifactId"     : "Specifies the ID of the artifact the binary is being copied to.",
      "DiffAbortThreshold" : "Specified in bytes, an upper limit for original diffs to try to enhance. This allows short circuiting lengthy optimisation attempts on large diffs which may not benefit. Range accepted is n >= 1GB, defaults to never abort.",
      "FileAttributeList"  : "A path to a text file containing a list of files and corresponding special attributes (e.g. executable bit) that should be set. See Setting Special File Attributes section for a description of the file contents. Note that the attributes file should not be inside your BuildRoot to ensure that it does not get erroneously included in your binary upload.",
      "FileIgnoreList"     : "A path to a text file containing files to be included in the binary. The files must be BuildRoot relative. This is an alternative to using FileIgnoreList.",
      "FileList"           : "A path to a text file containing files to be included in the binary. The files must be BuildRoot relative. This is an alternative to using FileIgnoreList.",
      "InstallTagsA"       : "Specifies in quotes a comma separated list of install tags used on BuildVersionA. You should include an empty string if you want to count untagged files. Leaving the parameter out will use all files. <br><br>• InstallTagsA=\"\" will be untagged files only. <br>• InstallTagsA=\",tag\" will be untagged files plus files tagged with `tag`. <br>• InstallTagsA=\"tag\" will be files tagged with `tag` only.",
      "InstallTagsB"       : "Specifies in quotes a comma separated list of install tags used on BuildVersionB. Same rules apply as InstallTagsA.",
      "Label"              : "The label name to apply to your binary. This must be the string \"Live\" when setting a binary as live to the public. Additionally, the string “Archive” can be used to label a single binary per platform that should be retained even after it is no longer live. Unlabeled binaries will be deleted after roughly a week by automatic cleanup jobs.",
      "Num"                : "Restrict the number of binaries returned. Binaries are returned in date order with the most recent first.",
      "OnlyLabeled"        : "Only list binaries that are associated with a label.",
      "OrganizationId"     : "Use the Organization ID string that was provided along with your credentials.",
      "OutputFile"         : "The list of binaries will be output to the specified file as a JSON array.",
      "Platform"           : "The platform associated with the binary to be labeled. Currently must be one of: [Windows, Win32, Mac]",
      "ProductId"          : "Use the Product ID string that was provided along with your credentials.",
      "SandboxId"          : "Specifies the id of the sandbox to label this binary under. If not provided, the binary will be labeled for public sandbox.",
      "SourceArtifactId"   : "Specifies the ID of the artifact the binary is being copied from."
  }
}