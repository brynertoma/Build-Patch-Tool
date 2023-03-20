//----------------------------------------------------------
// IMPORTS
//----------------------------------------------------------
import { open                             } from '@tauri-apps/api/dialog';
import { appConfigDir                     } from '@tauri-apps/api/path';
import { writeFile, readTextFile, exists  } from '@tauri-apps/api/fs';
import { invoke                           } from '@tauri-apps/api'


//----------------------------------------------------------
// GLOBALS
//----------------------------------------------------------
let toolExe    : null | string | string[]
let execute    : HTMLInputElement
let toolSelect : HTMLInputElement
let toolPath   : HTMLInputElement
let modeSelect : HTMLSelectElement
let inputs     : HTMLDivElement
let config     : any = {}
let elements   : any[] = []
let commands   : any
let tooltips   : any
let commandList: any
let outputArea : HTMLTextAreaElement

let $  = document.querySelector   .bind(document)
let $$ = document.querySelectorAll.bind(document)


//----------------------------------------------------------
// DOM CONTENT LOADED
//----------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  toolPath   = $("#toolPath"  ) as HTMLInputElement
  execute    = $("#execute"   ) as HTMLInputElement
  toolSelect = $("#toolSelect") as HTMLInputElement
  modeSelect = $("#mode"      ) as HTMLSelectElement
  inputs     = $("#inputs"    ) as HTMLDivElement
  outputArea = $("#output"    ) as HTMLTextAreaElement

  elements.push($$(".disableable"))
  execute.classList.add('tooltip')

  execute   .addEventListener("click", ExecuteCommand)
  toolSelect.addEventListener("click", SelectTool)
  modeSelect.addEventListener("change", ModeUpdated)

  commands = JSON.parse(await readTextFile("./assets/commands.json"))
  tooltips = JSON.parse(await readTextFile("./assets/tooltips.json"))

  outputArea.value += commands
  outputArea.value += tooltips

  CreateModeSelectionMenu()

  toolSelect.disabled = false
  LoadSettings()
});


//----------------------------------------------------------
// CREATE MODE SELECTION MENU
//----------------------------------------------------------
function CreateModeSelectionMenu() {

  for (let key in commands) {
    if (String(key) == "common") continue;
    let option = document.createElement("option")
    option.setAttribute("value", Capitalize(key))
    option.innerHTML = GetDisplayString(key)
    modeSelect.appendChild(option)
  }
}


//----------------------------------------------------------
// LOAD SETTINGS
//----------------------------------------------------------
async function LoadSettings() {

  let result = await exists(String('bpt-config.json'))

  outputArea.value += "\n🔎Searching for previous configuration settings.."

  if (result) {
    outputArea.value += "\n⌛Config found and loaded!"
    config            = JSON.parse(await readTextFile('bpt-config.json'));
    toolPath.value    = config.toolExe || ''
    toolExe           = config.toolExe
  } else {
    outputArea.value += "\n❌No configuration file found.."
    SelectTool()
    toolPath.value    = String(toolExe)
    await writeFile(`bpt-config.json`, JSON.stringify({ toolExe }));
    outputArea.value += "\n✅New config file created!"
  }

  modeSelect.value = config.mode || ''
  ModeUpdated();

  if (!await exists(String(toolExe))) toolExe = null
  ToolExeUpdated()
}


//----------------------------------------------------------
// SELECT TOOL
//----------------------------------------------------------
async function SelectTool() {
  toolExe = await open({
    directory: false,
    filters: [{
      name: 'Build Patch Tool',
      extensions: ['exe']
    }],
    defaultPath: await appConfigDir(),
  });

  if (toolExe == null) {
    let result = await exists(String(toolPath.innerHTML));
    if (result) toolExe = config.toolExe
  }

  ToolExeUpdated();
}


//----------------------------------------------------------
// TOOL EXE UPDATED
//----------------------------------------------------------
let ToolExeUpdated = async () => {

  if (toolExe) {

    toolPath.innerHTML = String(toolExe)
    config             = Object.assign({}, { toolExe }, config)
    await writeFile(`bpt-config.json`, JSON.stringify( config ));

    if (modeSelect.value == '') {
      modeSelect.disabled = false
      return
    }

    DisableElements(false)
    execute.classList.remove('tooltip')
    return
  }

  toolPath.innerHTML = "&nbsp;"
  DisableElements(true)
  toolSelect.disabled = false
}


//----------------------------------------------------------
// MODE UPDATED
//----------------------------------------------------------
function ModeUpdated() {

  ResetOutput()

  while (inputs.firstChild) {
    inputs.removeChild(inputs.firstChild)
  }

  elements = []
  execute.disabled = false

  commandList = commands.common

  switch (modeSelect.value) {
    case "CopyBinary"    : commandList = commands.copyBinary;    break;
    case "DeleteBinary"  : commandList = commands.deleteBinary;  break;
    case "DeltaPatch"    : commandList = commands.deltaPatch;    break;
    case "DiffBinaries"  : commandList = commands.diffBinaries;  break;
    case "LabelBinary"   : commandList = commands.labelBinary;   break;
    case "ListBinaries"  : commandList = commands.listBinaries;  break;
    case "UnlabelBinary" : commandList = commands.unlabelBinary; break;
    case "UploadBinary"  : commandList = commands.uploadBinary;  break;
    default              : execute.disabled = true
  }

  commandList = Object.assign({}, commands.common, commandList)

  for (let key in commandList) {
    const p     = document.createElement("p")
    const input = document.createElement("input")

    p.appendChild(input)

    AddTip(p, key)

    let type

    switch (commandList[key].type) {
      case "pwd": type = "password"; AddPasswordToggle(p); break;
      case "val": type = "text";        break;
      case "num": type = "number";      break;
      case "exe": type = "text";        break; // TODO: add event listener
      case "txt": type = "text";        break; // TODO: add event listener
      default: type = "text"
    }

    input.setAttribute("required", commandList[key].required)
    input.setAttribute("type", type)
    input.setAttribute("id", key)
    input.setAttribute("placeholder", GetDisplayString(key));
    input.classList.add("disableable")
    input.value = config[key] || '';
    inputs.appendChild(p)
  }

  elements.push($$(".disableable"))

  const toggleButtons = $$('.pass')
  toggleButtons.forEach(button => { button.addEventListener('mousedown', function (this: HTMLElement) { ToggleVisibility(this)})})
  toggleButtons.forEach(button => { button.addEventListener('mouseup',   function (this: HTMLElement) { ToggleVisibility(this)})})
}


//----------------------------------------------------------
// ADD PASSWORD TOGGLE
//----------------------------------------------------------
function AddPasswordToggle(p: HTMLElement) {
  const eye = document.createElement("i")
  eye.classList.add("bi")
  eye.classList.add("bi-eye-slash-fill")
  eye.classList.add("pass")
  p.appendChild(eye)
}


//----------------------------------------------------------
// ADD TIP
//----------------------------------------------------------
function AddTip(p: HTMLElement, key: any) {
  document.createElement("i")
  const tip = document.createElement("i")
  tip.setAttribute("data-tip", tooltips[Capitalize(key)])
  tip.classList.add("bi")
  tip.classList.add("bi-info-square")
  tip.classList.add("tip")
  p.appendChild(tip)
}


//----------------------------------------------------------
// GET DISPLAY STRING
//----------------------------------------------------------
function GetDisplayString(key: string) {
  const pattern = /([A-Z])/g;
  return Capitalize(key).replace(pattern, ' $1').trim()
}


//----------------------------------------------------------
// CAPITALIZE
//----------------------------------------------------------
function Capitalize(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1)
}


//----------------------------------------------------------
// DISABLE ELEMENTS
//----------------------------------------------------------
function DisableElements(disable: boolean) {
  for (let i = 0; i < elements.length; i++)
    for (let j = 0; j < elements[i].length; j++)
      elements[i][j].disabled = disable;
}


//----------------------------------------------------------
// TOGGLE PASSWORD VISIBILITY
//----------------------------------------------------------
let ToggleVisibility = (button : HTMLElement) => {
  const field = button.previousElementSibling?.previousElementSibling as HTMLInputElement
  field.type = field.type === 'password' ? 'text' : 'password';
  button.classList.toggle('bi-eye-slash-fill');
  button.classList.toggle('bi-eye-fill');
}


//----------------------------------------------------------
// EXECUTE COMMAND
//----------------------------------------------------------
async function ExecuteCommand() {
  DisableElements(true)

  const { command, valid, newConfigObject } = BuildCommand()

  if (!valid) {
    DisableElements(false)
    ResetOutput()
    outputArea.value += `${String(command)}`
    return;
  }

  let result = await invoke('run_command', { command })

  ResetOutput()
  outputArea.value += String(result);

  DisableElements(false)

  config = Object.assign({}, config, newConfigObject)
  
  try {
    await writeFile(`bpt-config.json`, JSON.stringify(config));
    outputArea.value += `\n🥳Configuration saved!`
  } catch (e) {
    outputArea.value += `\n${e}`
    console.error(e);
  }
}


//----------------------------------------------------------
// BUILD COMMAND
//----------------------------------------------------------
function BuildCommand() : { command: string, valid: boolean, newConfigObject: { } } {

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
// RESET OUTPUT
//----------------------------------------------------------
function ResetOutput() {
  outputArea.value = "💩 Made with Bry 💖 \n\n"
}
