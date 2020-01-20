/*
 * Copyright 2019 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Capabilities
export {
  hasProxy,
  getValidCredentials,
  inBrowser,
  inElectron,
  isHeadless,
  assertLocalAccess,
  assertHasProxy,
  setHasAuth,
  getAuthValue
} from './core/capabilities'
export { CapabilityRegistration } from './models/plugin'

// Commands
export {
  CommandOptions,
  CommandLine,
  Evaluator,
  ExecType,
  KResponse,
  ParsedOptions,
  EvaluatorArgs as Arguments,
  Event,
  CommandRegistrar as Registrar
} from './models/command'
export { optionsToString as unparse } from './core/utility'
export {
  MixedResponse,
  RawResponse,
  ResourceModification,
  isMetadataBearingByReference as isResourceByReference
} from './models/entity'
export { isCommandHandlerWithEvents } from './models/command'
export { ExecOptions, withLanguage } from './models/execOptions'
export { Streamable } from './models/streamable'

/** @deprecated */
export { CustomSpec as CustomResponse } from './webapp/views/sidecar-core'

// Editor registration
export { EditorProvider, registerEditor } from './webapp/views/registrar/editors'

// Errors
export { CodedError } from './models/errors'
export { isUsageError, UsageError, UsageModel, UsageRow } from './core/usage-error'

// eventBus
export { default as eventBus } from './core/events'

// i18n
export { fromMap as i18nFromMap, default as i18n } from './util/i18n'

// content injection
export { injectCSS, injectScript, loadHTML } from './webapp/util/inject'

// models
export { MetadataBearing as ResourceWithMetadata } from './models/entity'
export { Watchable, Watcher, WatchPusher } from './core/jobs/watchable'
export { Abortable } from './core/jobs/job'
import { Tab } from './webapp/tab'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function History(tab: Tab) {
  const model = (await import('./models/history')).default
  return model
}

// pretty printing
export { prettyPrintTime } from './webapp/util/time'
export { default as stripAnsi } from './webapp/util/strip-ansi'
export { default as prettyPrintAnsi } from './webapp/util/pretty-print'
export async function AsciiFormatters() {
  const [{ formatUsage }, { preprocessTable, formatTable }] = await Promise.all([
    import(/* webpackMode: "lazy" */ './webapp/util/ascii-to-usage'),
    import(/* webpackMode: "lazy" */ './webapp/util/ascii-to-table')
  ])
  return { formatUsage, preprocessTable, formatTable }
}

// registrars
export { SidecarMode as Mode } from './webapp/bottom-stripe'
export {
  SidecarModeFilter as ModeFilter,
  ModeRegistration,
  registerModeWhen,
  registerSidecarMode as registerMode
} from './webapp/views/registrar/modes'
export { BadgeRegistration, registerSidecarBadge as registerBadge } from './webapp/views/registrar/badges'
export { Badge, BadgeSpec } from './webapp/views/badge'
export { PluginRegistration, PreloadRegistration, PreloadRegistrar } from './models/plugin'

// REPL utils
export { split, _split, Split } from './repl/split'
export { ReplEval, DirectReplEval } from './repl/types'
export { default as encodeComponent } from './repl/encode'
export {
  getImpl as getReplImpl,
  exec as internalBeCarefulExec,
  pexec as internalBeCarefulPExec,
  setEvaluatorImpl
} from './repl/exec'

// Selection
export {
  /** @deprecated */ isVisible as isSidecarVisible,
  /** @deprecated */ isFullscreen as isSidecarFullscreen,
  /** @deprecated */ hide as hideSidecar,
  /** @deprecated */ show as showSidecar,
  /** @deprecated */ toggleMaximization,
  clearSelection,
  currentSelection
} from './webapp/views/sidecar-visibility'
export { /** @deprecated */ SidecarState, /** @deprecated */ getSidecarState } from './webapp/views/sidecar-state'
export { clearSelection as closeAllViews } from './webapp/views/sidecar-visibility'
export { /** @deprecated */ default as sidecarSelector } from './webapp/views/sidecar-selector'

// Tabs
export { Tab, getTabFromTarget, getCurrentTab, getTabId, sameTab } from './webapp/tab'
export { default as TabState } from './models/tab-state'

// Themes
export { default as Theme } from './webapp/themes/Theme'
export { findByName as findThemeByName } from './webapp/themes/find'
export { getDefault as getDefaultTheme } from './webapp/themes/default'
export {
  switchTo as switchToTheme,
  getPersistedThemeChoice,
  resetToDefault as resetToDefaultTheme
} from './webapp/themes/persistence'

// CLI
export {
  getPrompt,
  getCurrentPrompt,
  getCurrentPromptLeft,
  getBlockOfPrompt,
  setUsingCustomPrompt,
  unsetUsingCustomPrompt
} from './webapp/prompt'
export { getCurrentBlock, getCurrentProcessingBlock, resetCount, setCustomCaret } from './webapp/block'
export { setStatus, Status } from './webapp/status'
export { listen as internalBeCarefulListen } from './webapp/listen'
export { disableInputQueueing, pasteQueuedInput } from './webapp/queueing'
export { clearPendingTextSelection, setPendingTextSelection, clearTextSelection } from './webapp/text-selection'

// generic UI
export { isPopup } from './webapp/popup-core'
export { removeAllDomChildren as empty } from './webapp/util/dom'
export { default as Presentation } from './webapp/views/presentation'
export { Button, Mode as MultiModalMode, MultiModalResponse } from './models/mmr/types'
export { ToolbarTextImpl as ToolbarText } from './webapp/views/toolbar-text'

// low-level UI
export { partial as partialInput, isUsingCustomPrompt } from './webapp/prompt'
export { scrollIntoView } from './webapp/scroll'
export { default as doCancel } from './webapp/cancel'
export { default as ElementMimic } from './util/element-mimic'
export { keys as KeyCodes, isCursorMovement } from './webapp/keys'
export {
  buttonExists as topTabButtonExists,
  addIcon as topTabAddIcon,
  removeIcon as topTabRemoveIcon
} from './webapp/views/top-tabs'

// Prompt
export { prompt } from './webapp/prompt-for-input'

// Plugins
export { commandsOffered as commandsOfferedByPlugin, userHome as pluginUserHome } from './api/plugins'

// Settings
export { inBottomInputMode, userDataDir, exportTo as exportSettingsTo, uiThemes } from './core/settings'

// Storage for user data
export { default as Store } from './models/store'

// SymbolTable
export { default as SymbolTable } from './core/symbol-table'

// Tables
export { TableStyle, Table, Row, Cell, isTable } from './webapp/models/table'

// Util
export { findFileWithViewer, findFile, isSpecialDirectory, addPath as augmentModuleLoadPath } from './core/find-file'
export { expandHomeDir } from './util/home'
export { flatten } from './core/utility'
export { promiseEach } from './util/async'

// Electron
export { tellMain } from './webapp/electron-events'

// main
export { main } from './main/main'
export { default as boot } from './webapp/bootstrap/boot'

// StatusStripe types
export { TextWithIcon as StatusTextWithIcon, StatusStripeController } from './webapp/status-stripe'
