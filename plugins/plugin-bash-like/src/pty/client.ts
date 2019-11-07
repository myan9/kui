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

/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import Debug from 'debug'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import * as xterm from 'xterm'
import stripClean from 'strip-ansi'
import { safeLoad } from 'js-yaml'
import { webLinksInit } from 'xterm/lib/addons/webLinks/webLinks'

import { Capabilities, Commands, Errors, eventBus, Tables, UI, Util } from '@kui-shell/core'
import { SidecarState, getSidecarState } from '@kui-shell/core/webapp/views/sidecar'
import {
  setCustomCaret,
  clearPendingTextSelection,
  setPendingTextSelection,
  clearTextSelection,
  disableInputQueueing,
  pasteQueuedInput,
  sameTab
} from '@kui-shell/core/webapp/cli'

import { formatUsage } from '@kui-shell/core/webapp/util/ascii-to-usage'
import { preprocessTable, formatTable } from '@kui-shell/core/webapp/util/ascii-to-table'

import * as ui from './ui'
import * as session from './session'
import { cleanupTerminalAfterTermination } from './util'
import { Channel, InProcessChannel, WebViewChannelRendererSide } from './channel'

const debug = Debug('plugins/bash-like/pty/client')

/* eslint-disable no-control-regex */
const enterApplicationModePattern = /\x1b\[\?1h/
const exitApplicationModePattern = /\x1b\[\?1l/
const enterAltBufferPattern = /\x1b\[\??(47|1047|1049)h/
const exitAltBufferPattern = /\x1b\[\??(47|1047|1049)l/
/* eslint-enable no-control-regex */

interface Size {
  resizeGeneration: number
  sidecarState: SidecarState
  rows: number
  cols: number
}
let resizeGeneration = 0
if (window) {
  window.addEventListener('resize', () => {
    resizeGeneration++
  })
}
function getCachedSize(tab: UI.Tab): Size {
  const cachedSize: Size = tab['_kui_pty_cachedSize']
  if (
    cachedSize &&
    cachedSize.sidecarState === getSidecarState(tab) &&
    cachedSize.resizeGeneration === resizeGeneration
  ) {
    return cachedSize
  }
}
function setCachedSize(tab: UI.Tab, { rows, cols }: { rows: number; cols: number }) {
  tab['_kui_pty_cachedSize'] = {
    rows,
    cols,
    sidecarState: getSidecarState(tab),
    resizeGeneration
  }
}

interface HTerminal extends xterm.Terminal {
  _core: {
    viewport: {
      _terminal: {
        cols: number
        options: { letterSpacing: number }
        charMeasure: { width: number }
      }
      _dimensions: {
        scaledCharWidth: number
        actualCellWidth: number
        actualCellHeight: number
        canvasWidth: number
        scaledCanvasWidth: number
        scaledCellWidth: number
      }
    }
  }
}

class Resizer {
  /** our tab */
  private readonly tab: UI.Tab

  /** execOptions */
  private readonly execOptions: Commands.ExecOptions

  /** exit alt buffer mode async */
  private exitAlt?: NodeJS.Timeout

  /** are we in alt buffer mode? */
  private alt = false

  /** were we ever in alt buffer mode? */
  private wasAlt = false

  /** are we in application mode? e.g. less */
  private app = false

  /** have we already deleted empty rows? */
  private _frozen = false

  private readonly terminal: HTerminal

  private _ws: Channel

  // remember any global event handlers that we registered in the
  // constructor, so that we can remove them in destroy()
  private readonly resizeNow: () => void
  private readonly clearXtermSelectionNow: () => void

  constructor(terminal: xterm.Terminal, tab: UI.Tab, execOptions: Commands.ExecOptions) {
    this.tab = tab
    this.execOptions = execOptions
    this.terminal = terminal as HTerminal

    // window resize; WARNING: since this is a global event, make sure
    // to remove the event listener in the destroy() method
    this.resizeNow = this.resize.bind(this, true)
    window.addEventListener('resize', this.resizeNow)

    // text selection; WARNING: since this is a global event, make
    // sure to remove the event listener in the destroy() method
    this.clearXtermSelectionNow = () => {
      terminal.clearSelection()
    }
    document.addEventListener('select', this.clearXtermSelectionNow)

    const ourTab = tab
    eventBus.on('/sidecar/toggle', ({ tab }: { tab: UI.Tab }) => {
      // sidecar resize
      if (sameTab(tab, ourTab)) {
        this.resizeNow()
      } else {
        debug('toggle event, but not for our sidecar')
      }
    })

    this.resize()
  }

  get ws(): Channel {
    return this._ws
  }

  set ws(ws: Channel) {
    this._ws = ws
  }

  destroy() {
    this.exitAltBufferMode()
    this.exitApplicationMode()
    window.removeEventListener('resize', this.resizeNow)
    document.removeEventListener('select', this.clearXtermSelectionNow)
  }

  private isEmptyCursorRow(row: Element): boolean {
    return row.children.length === 1 && row.children[0].classList.contains('xterm-cursor')
  }

  /**
   * xtermjs inserts lines to create a line-wrapping effect; this
   * changes the behavior so that the browser can reflow them
   * naturally (in tandem with some CSS)
   *
   */
  reflowLineWraps(element = this.terminal.element) {
    const rows = element.querySelector('.xterm-rows').children
    const nLines = this.terminal.buffer.length
    for (let idx = 0; idx < nLines - 1; idx++) {
      const line = this.terminal.buffer.getLine(idx)
      const nextLine = this.terminal.buffer.getLine(idx + 1)
      if (nextLine.isWrapped) {
        if (rows[idx + 1]) {
          rows[idx + 1].classList.add('xterm-is-wrapped')
        }

        if (!line.isWrapped) {
          // see https://github.com/IBM/kui/issues/1605 which covers
          // wrapped -> notWrapped, from one line to the next;
          // that the first of that pair belongs with the second, but
          // itself wasn't created as a result of wrapping (that's my
          // interpretation of `isWrapped` - @starpit)
          if (rows[idx]) {
            rows[idx].classList.add('xterm-is-wrapped')
            rows[idx].classList.add('xterm-is-wrapped-with-prefix-break')
          }
          // and the CSS for these two classes will be managed by
          // web/css/xterm.css
        }
      }
    }
  }

  /**
   * Hide trailing empty blanks
   *
   */
  hideTrailingEmptyBlanks(remove = false, element = this.terminal.element, from = 0) {
    if (this.frozen) {
      // we have already trimmed trailing empty blanks by removal from
      // the DOM; this is irreversible
      return
    }

    // debug('hideTrailingEmptyBlanks', remove, from)

    if (!remove) {
      const hidden = element.querySelectorAll('.xterm-rows > .xterm-hidden-row')
      for (let idx = 0; idx < hidden.length; idx++) {
        hidden[idx].classList.remove('xterm-hidden-row')
      }
    } else {
      this.frozen = true
    }

    const rows = element.querySelector('.xterm-rows').children
    for (let idx = rows.length - 1; idx >= from; idx--) {
      if (rows[idx].children.length === 0) {
        if (remove) {
          rows[idx].remove()
        } else {
          rows[idx].classList.add('xterm-hidden-row')
        }
      } else {
        break
      }
    }
  }

  /**
   * Render a row that contains only the cursor as invisible
   *
   */
  static hideCursorOnlyRow(element: Element) {
    cleanupTerminalAfterTermination(element)
  }

  static paddingHorizontal(elt: Element) {
    const style = window.getComputedStyle(elt)
    return (
      parseInt(style.getPropertyValue('padding-left') || '0', 10) +
      parseInt(style.getPropertyValue('padding-right') || '0', 10)
    )
  }

  static paddingVertical(elt: Element) {
    const style = window.getComputedStyle(elt)
    return (
      parseInt(style.getPropertyValue('padding-top') || '0', 10) +
      parseInt(style.getPropertyValue('padding-bottom') || '0', 10)
    )
  }

  private getSize(forceRecompute: boolean) {
    const cachedSize = getCachedSize(this.tab)
    if (!forceRecompute && cachedSize !== undefined) {
      // using cached size
      return cachedSize
    }

    const _core = this.terminal._core
    const hack = _core.viewport
    const dimensions = hack._dimensions
    const scaledCharWidth = hack._terminal.charMeasure.width * window.devicePixelRatio
    const ratio = scaledCharWidth / dimensions.scaledCharWidth

    const selectorForSize = '.repl-inner'
    const sizeElement = this.tab.querySelector(selectorForSize)
    const enclosingRect = sizeElement.getBoundingClientRect()

    const selectorForWidthPad = '.repl-inner .repl-block .repl-output'
    const widthPadElement = this.tab.querySelector(selectorForWidthPad)
    const heightPadElement = sizeElement

    const width = enclosingRect.width - Resizer.paddingHorizontal(widthPadElement)
    const height = enclosingRect.height - Resizer.paddingVertical(heightPadElement)

    const cols = Math.floor(width / dimensions.actualCellWidth / ratio)
    const rows = Math.floor(height / dimensions.actualCellHeight)

    debug('getSize', cols, rows, width, height)

    const newSize = { rows, cols }
    if (!isNaN(rows) && !isNaN(cols)) {
      setCachedSize(this.tab, newSize)
    }

    return newSize
  }

  set frozen(val: boolean) {
    this._frozen = val
  }

  get frozen(): boolean {
    return this._frozen
  }

  /** flush=true means that it is likely that the dimensions might have changed; false means definitely have not changed */
  resize(flush = false, force = false) {
    if (this.frozen) {
      return
    }

    const { rows, cols } = this.getSize(flush)
    if (this.terminal.rows !== rows || this.terminal.cols !== cols || force) {
      debug('resize', cols, rows, this.terminal.cols, this.terminal.rows, this.inAltBufferMode())
      try {
        if (!isNaN(rows) && !isNaN(cols)) {
          this.terminal.resize(cols, rows)

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        }
      } catch (err) {
        debug(err.message)
      }
    }
  }

  inApplicationMode(): boolean {
    return this.app
  }

  inAltBufferMode(): boolean {
    return this.alt
  }

  wasEverInAltBufferMode(): boolean {
    return this.wasAlt
  }

  enterApplicationMode() {
    // switching to application mode
    debug('switching to application mode')
    this.app = true
    this.tab.classList.add('xterm-application-mode')
  }

  exitApplicationMode() {
    // switching out of application mode
    debug('switching from application mode')
    this.app = false
    this.tab.classList.remove('xterm-application-mode')
  }

  enterAltBufferMode() {
    debug('switching to alt buffer mode')
    this.alt = true
    this.wasAlt = true
    if (this.exitAlt) {
      clearTimeout(this.exitAlt)
    }

    /** e.g. `kubectl exec -it mypod -- vi` doesn't seem to have the proper size */
    if (this.execOptions['pty/force-resize']) {
      const { rows, cols } = this.getSize(false)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'resize', cols, rows: rows + 1 }))
        setTimeout(() => {
          this.ws.send(JSON.stringify({ type: 'resize', cols, rows: rows }))
          this.tab.classList.add('xterm-alt-buffer-mode')
        }, 1)
      }
    } else {
      this.tab.classList.add('xterm-alt-buffer-mode')
    }
  }

  exitAltBufferMode() {
    // switching to normal buffer mode
    debug('switching from alt buffer mode')
    this.alt = false
    this.tab.classList.remove('xterm-alt-buffer-mode')
  }
}

/**
 * Inject current font settings
 *
 */
let cachedFontProperties: { fontFamily: string; fontSize: number }
function getFontProperties(flush: boolean) {
  if (flush || !cachedFontProperties) {
    debug('computing font properties')
    const fontTheme = getComputedStyle(document.querySelector('body .repl .repl-input input'))

    /** helper to extract a kui theme color */
    const val = (key: string, kind = 'color'): string => fontTheme.getPropertyValue(`--${kind}-${key}`).trim()

    const fontSize = parseFloat(fontTheme.fontSize.replace(/px$/, ''))
    const fontFamily = val('monospace', 'font')

    cachedFontProperties = { fontFamily, fontSize }
  }

  return cachedFontProperties
}
const injectFont = (terminal: xterm.Terminal, flush = false) => {
  try {
    const { fontFamily, fontSize } = getFontProperties(flush)
    terminal.setOption('fontFamily', fontFamily)
    terminal.setOption('fontSize', fontSize)

    debug('fontSize', fontSize)

    // FIXME. not tied to theme
    terminal.setOption('fontWeight', 400)
    terminal.setOption('fontWeightBold', 600)
  } catch (err) {
    console.error('Error setting terminal font size', err)
  }
}

type ChannelFactory = (tab: UI.Tab) => Promise<Channel>

/**
 * Create a websocket channel to a remote bash
 *
 */
const remoteChannelFactory: ChannelFactory = async (tab: UI.Tab) => {
  try {
    const { url, uid, gid }: { url: string; uid: number; gid: number } = await tab.REPL.qexec(
      'bash websocket open',
      undefined,
      undefined,
      {
        rethrowErrors: true
      }
    )
    debug('websocket url', url, uid, gid)
    const WebSocketChannel = (await import('./websocket-channel')).default
    return new WebSocketChannel(url, uid, gid)
  } catch (err) {
    const error = err as Errors.CodedError
    if (error.statusCode !== 503) {
      // don't bother complaining too much about connection refused
      console.error('error opening websocket', err)
    }
    throw err
  }
}

const electronChannelFactory: ChannelFactory = async () => {
  const channel = new InProcessChannel()
  channel.init()
  return channel
}

const webviewChannelFactory: ChannelFactory = async () => {
  console.log('webviewChannelFactory')
  const channel = new WebViewChannelRendererSide()
  channel.init()
  return channel
}

interface KuiTerminal extends HTerminal {
  _kuiAlreadyFocused: boolean
}

const focus = (terminal: KuiTerminal) => {
  if (!terminal._kuiAlreadyFocused) {
    setTimeout(() => {
      // expensive reflow, async it
      if (!terminal._kuiAlreadyFocused) {
        terminal._kuiAlreadyFocused = true
        terminal.focus()
      }
    }, 0)
  }
}

/**
 * websocket factory for remote/proxy connection
 *
 */
const getOrCreateChannel = async (
  cmdline: string,
  uuid: string,
  tab: UI.Tab,
  execOptions: Commands.ExecOptions,
  terminal: KuiTerminal
): Promise<Channel> => {
  const channelFactory = Capabilities.inBrowser()
    ? window['webview-proxy'] !== undefined
      ? webviewChannelFactory
      : remoteChannelFactory
    : electronChannelFactory

  const env = Object.assign({}, process.env, execOptions.env || {})

  // tell the server to start a subprocess
  const doExec = (ws: Channel) => {
    const msg = {
      type: 'exec',
      cmdline,
      uuid,
      rows: terminal.rows,
      cols: terminal.cols,
      cwd: process.env.PWD || (!Capabilities.inBrowser() && process.cwd()), // inBrowser: see https://github.com/IBM/kui/issues/1966
      env: Object.keys(env).length > 0 && env // VERY IMPORTANT: don't send an empty process.env
    }
    debug('exec after open', msg)

    ws.send(JSON.stringify(msg))
  }

  const cachedws = session.getChannelForTab(tab)

  if (!cachedws || cachedws.readyState === WebSocket.CLOSING || cachedws.readyState === WebSocket.CLOSED) {
    // allocating new channel
    const ws = await channelFactory(tab)
    tab['ws'] = ws

    // when the websocket is ready, handle any queued input; only then
    // do we focus the terminal (till then, the CLI module will handle
    // queuing, and read out the value via disableInputQueueing()
    ws.on('open', () => doExec(ws))

    // when the websocket has closed, notify the user
    ws.on('close', () => {
      debug('channel has closed')
      if (!tab['state'].closed) {
        debug('attempting to reestablish connection, because the tab is still open ')
        ui.setOffline()
        session.pollUntilOnline(tab)
      }
    })

    return ws
  } else {
    // reusing existing websocket
    doExec(cachedws)
    focus(terminal)
    return cachedws
  }
}

/**
 * safeLoad from js-yaml, but protected with try/catch
 *
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeLoadWithCatch(raw: string): Record<string, any> {
  try {
    return safeLoad(raw)
  } catch (err) {
    console.error(err)
  }
}

/**
 * In one xterm-row, squash consecutive spans that have the same
 * className. We do this to avoid costly reflows, which xterm.js
 * causes a huge number of, and that cost O(numSpans). xterm.js
 * creates one span per character :(
 *
 */
function squashRow(row: HTMLElement) {
  if (row.children.length > 1) {
    let previous = row.children[0] as HTMLElement
    let current = row.children[1] as HTMLElement
    let runningSquash = previous.innerText

    while (current) {
      const next = current.nextElementSibling as HTMLElement
      if (previous.className === current.className) {
        current.remove()
        runningSquash += current.innerText
      } else {
        if (runningSquash !== previous.innerText) {
          previous.innerText = runningSquash
        }

        previous = current
        runningSquash = previous.innerText
      }
      current = next
    }

    if (runningSquash !== previous.innerText) {
      previous.innerText = runningSquash
    }
  }

  // if, after squashing, we have a single span child, inline its text
  // directly into the row element
  if (row.children.length === 1) {
    const singleton = row.firstElementChild as HTMLElement
    if (!singleton.className) {
      // only for undecorated solitary children
      singleton.remove()
      row.innerText = singleton.innerText
    }
  }
}

/**
 * See the above comment for squashRow(). This is the enclosing method
 * that iterates over the rows. This is expected to be called only
 * after the process terminates.
 *
 */
function squash(elt: HTMLElement) {
  const rows = elt.querySelectorAll('.xterm-rows > div') as NodeListOf<HTMLElement>
  for (let idx = 0; idx < rows.length; idx++) {
    squashRow(rows[idx])
  }
}

/**
 * Inject xterm.css if we haven't already
 *
 */
let alreadyInjectedCSS: boolean
function injectXtermCSS() {
  if (!alreadyInjectedCSS) {
    if (Capabilities.inBrowser()) {
      UI.injectCSS({ css: require('xterm/lib/xterm.css'), key: 'xtermjs' })
      UI.injectCSS({
        css: require('@kui-shell/plugin-bash-like/web/css/xterm.css'),
        key: 'kui-xtermjs'
      })
    } else {
      UI.injectCSS({
        path: path.join(path.dirname(require.resolve('xterm/package.json')), 'lib/xterm.css'),
        key: 'xtermjs'
      })
      UI.injectCSS({
        path: path.join(path.dirname(require.resolve('@kui-shell/plugin-bash-like/package.json')), 'web/css/xterm.css'),
        key: 'kui-xtermjs'
      })
    }
    alreadyInjectedCSS = true

    // we did indeed inject the css this time around
    return true
  } else {
    // we didn't inject the css this time around
    return false
  }
}

interface Options extends Commands.ParsedOptions {
  o?: string
  out?: string
  output?: string
}

/**
 *
 *
 */
export const doExec = (
  tab: UI.Tab,
  block: HTMLElement,
  cmdline: string,
  argvNoOptions: string[],
  parsedOptions: Options,
  execOptions: Commands.ExecOptions
) =>
  new Promise((resolve, reject) => {
    const contentType =
      parsedOptions.o ||
      parsedOptions.output ||
      parsedOptions.out ||
      (argvNoOptions[0] === 'cat' && /json$/.test(argvNoOptions[1]) && 'json') ||
      (argvNoOptions[0] === 'cat' && (/yaml$/.test(argvNoOptions[1]) || /yml$/.test(argvNoOptions[1])) && 'yaml')
    const expectingSemiStructuredOutput = /yaml|json/.test(contentType)

    const injectingCSS = injectXtermCSS()

    // this is the main work
    const exec = async () => {
      // attach the terminal to the DOM
      try {
        const parent = block.querySelector('.repl-result')
        const xtermContainer = document.createElement('xterm')
        xtermContainer.classList.add('xterm-container')
        xtermContainer.classList.add('repl-output-like')
        // xtermContainer.classList.add('zoomable')
        parent.appendChild(xtermContainer)

        if (execOptions.replSilence) {
          debug('repl silence')
          xtermContainer.style.display = 'none'
          xtermContainer.classList.add('repl-temporary')
        }

        // xtermjs will handle the "block"
        setCustomCaret(block)

        const cachedSize = getCachedSize(tab)
        const { fontFamily, fontSize } = getFontProperties(false)
        // creating terminal
        const terminal = new xterm.Terminal({
          rendererType: 'dom',
          cols: cachedSize && cachedSize.cols,
          rows: cachedSize && cachedSize.rows,
          fontFamily,
          fontSize
        }) as KuiTerminal

        // used to manage the race between pending writes to the
        // terminal canvas and process exit; see
        // https://github.com/IBM/kui/issues/1272
        let cbAfterPendingWrites: () => void
        let pendingWrites = 0

        terminal.open(xtermContainer)
        webLinksInit(terminal)

        // theming
        // injectFont(terminal) // inject once on startup
        const doInjectTheme = () => injectFont(terminal, true)
        eventBus.on('/theme/change', doInjectTheme) // and re-inject when the theme changes

        const resizer = new Resizer(terminal, tab, execOptions)

        // respond to font zooming
        const doZoom = () => {
          injectFont(terminal, true)
          resizer.resize()
        }
        eventBus.on('/zoom', doZoom)

        const cleanupEventHandlers = () => {
          eventBus.off('/zoom', doZoom)
          eventBus.off('/theme/change', doInjectTheme)
        }

        // heuristic for hiding empty rows
        terminal.element.classList.add('xterm-empty-row-heuristic')
        setTimeout(() => terminal.element.classList.remove('xterm-empty-row-heuristic'), 100)

        //
        // on exit, remove event handlers and the like
        //
        const cleanUpTerminal = () => {
          cleanupEventHandlers()
          resizer.destroy()

          if (execOptions.type === Commands.ExecType.Nested && execOptions.quiet !== false) {
            xtermContainer.remove()
          } else {
            xtermContainer.classList.add('xterm-terminated')
          }
        }

        //
        // create a channel to the underlying node-pty
        //
        const ourUUID = uuid()
        const ws: Channel = await getOrCreateChannel(cmdline, ourUUID, tab, execOptions, terminal).catch(
          (err: Errors.CodedError) => {
            if (err.code !== 503) {
              // don't bother complaining too much about connection refused
              console.error('error creating channel', err)
            }
            cleanUpTerminal()
            throw err
          }
        )
        resizer.ws = ws

        let definitelyNotUsage = argvNoOptions[0] === 'git' || execOptions.rawResponse // short-term hack u ntil we fix up ascii-to-usage
        let definitelyNotTable = expectingSemiStructuredOutput || argvNoOptions[0] === 'grep' || execOptions.rawResponse // short-term hack until we fix up ascii-to-table

        //
        // here, we deal with user typing! we need to relay keyboard
        // input to the node-pty, but we do so with a bit of debouncing
        //
        let queuedInput = ''
        let flushAsync: NodeJS.Timeout
        terminal.on('key', (key: string) => {
          if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
            debug('queued input out back', key)
            queuedInput += key
          } else {
            // even with the xterm active, buffer input and flush in
            // chunks to increase responsiveness for fast typing, and
            // to reduce load in the proxy server (compared to sending
            // one message per keypress)
            queuedInput += key

            // if the user typed something, be very conservative
            definitelyNotTable = true
            definitelyNotUsage = true

            if (flushAsync) {
              clearTimeout(flushAsync)
            }
            flushAsync = setTimeout(() => {
              if (queuedInput && ws.readyState === WebSocket.OPEN) {
                const data = queuedInput
                queuedInput = ''
                ws.send(JSON.stringify({ type: 'data', data, uid: ourUUID }))
              }
            }, 20)
          }
        })

        //
        // here, we align browser selection and xterm.js selection models
        //
        const maybeClearSelection = () => {
          if (!terminal.hasSelection()) {
            clearPendingTextSelection()
          }
        }
        terminal.on('focus', maybeClearSelection)
        terminal.on('blur', maybeClearSelection)
        terminal.on('paste', (data: string) => {
          ws.send(JSON.stringify({ type: 'data', data }))
        })
        terminal.on('selection', () => {
          // debug('xterm selection', terminal.getSelection())
          clearTextSelection()
          setPendingTextSelection(terminal.getSelection())
        })

        //
        // here, we debounce scroll to bottom events
        //
        const activeDiv = tab.querySelector('.repl-inner')
        const doScroll = () => {
          if (!resizer.inAltBufferMode()) {
            activeDiv.scrollTop = activeDiv.scrollHeight
          }
        }
        const scrollPoll = setInterval(doScroll, 200)

        const notifyOfWriteCompletion = () => {
          if (pendingWrites > 0) {
            pendingWrites = 0
            if (cbAfterPendingWrites) {
              cbAfterPendingWrites()
              cbAfterPendingWrites = undefined
            }
          }
        }

        // xtermjs writes are asynchronous, and ultimately occur in an
        // animation frame; the result is that the terminal canvas may
        // receive updates after we receive a process exit event; but we
        // will always receive a `refresh` event when the animation
        // frame is done. see https://github.com/IBM/kui/issues/1272
        let first = true
        const onRefresh = async (evt: { start: number; end: number }) => {
          if (evt.end > evt.start || first) {
            resizer.hideTrailingEmptyBlanks()
          }
          notifyOfWriteCompletion()
          first = false
        }
        terminal.on('refresh', onRefresh)

        let bytesWereWritten = false
        let sawCode: number
        let pendingUsage = false
        let pendingTable: Commands.MixedResponse
        let raw = ''
        let nLinesRaw = 0

        const onFirstMessage = () => {
          const queuedInput = disableInputQueueing()
          if (queuedInput.length > 0) {
            debug('queued input up front', queuedInput)
            setTimeout(() => ws.send(JSON.stringify({ type: 'data', data: queuedInput })), 50)
          }

          // now that we've grabbed queued input, focus on the terminal,
          // and it will handle input for now until the process exits
          focus(terminal)
        }

        const onMessage = async (data: string) => {
          const msg = JSON.parse(data)

          if (msg.uuid !== ourUUID) {
            return
          }

          if (msg.type === 'state' && msg.state === 'ready') {
            onFirstMessage()
          } else if (msg.type === 'data') {
            // plain old data flowing out of the PTY; send it on to the xterm UI

            if (!terminal._kuiAlreadyFocused) {
              onFirstMessage()
            }

            const flush = () => {
              if (pendingTable) {
                pendingTable = undefined
                definitelyNotTable = true
                definitelyNotUsage = true
                bytesWereWritten = true
                sawCode = /File exists/i.test(raw)
                  ? 409
                  : /no such/i.test(raw) || /not found/i.test(raw)
                  ? 404
                  : sawCode
                terminal.write(raw)
                raw = ''
              }
            }

            if (enterApplicationModePattern.test(msg.data)) {
              // e.g. less start
              flush()
              resizer.enterApplicationMode()
              focus(terminal)
            } else if (exitApplicationModePattern.test(msg.data)) {
              // e.g. less exit
              resizer.exitApplicationMode()
            }
            if (enterAltBufferPattern.test(msg.data)) {
              // we need to fast-track this; xterm.js does not invoke the
              // setMode/resetMode handlers till too late; we might've
              // called raw += ... even though we are in alt buffer mode
              flush()
              focus(terminal)
              resizer.enterAltBufferMode()
            } else if (exitAltBufferPattern.test(msg.data)) {
              // ... same here
              resizer.exitAltBufferMode()
            } else if (!resizer.inAltBufferMode()) {
              raw += msg.data
            }

            const maybeUsage =
              !resizer.wasEverInAltBufferMode() &&
              !definitelyNotUsage &&
              (pendingUsage ||
                formatUsage(cmdline, stripClean(raw), {
                  drilldownWithPip: true
                }))

            if (!definitelyNotTable && raw.length > 0 && !resizer.wasEverInAltBufferMode()) {
              try {
                const tables = (await preprocessTable(raw.split(/^(?=NAME|Name|ID|\n\*)/m))).filter(x => x)

                if (tables && tables.length > 0) {
                  const tableRows = Util.flatten(tables.filter(_ => _.rows !== undefined).map(_ => _.rows))

                  if (tableRows && tableRows.length > 0) {
                    // debug(`table came from ${stripClean(raw)}`)
                    // debug(`tableRows ${tableRows.length}`)
                    const command = argvNoOptions[0]
                    const verb = argvNoOptions[1]
                    const entityType = /\w+/.test(argvNoOptions[2]) && argvNoOptions[2]
                    const tableModel = formatTable(command, verb, entityType, parsedOptions, tableRows)
                    debug('tableModel', tableModel)

                    const trailingStrings = tables.map(_ => _.trailingString).filter(x => x)
                    if (trailingStrings && trailingStrings.length > 0) {
                      const trailers = await UI.PrettyPrinters.ansi(trailingStrings)
                      if (!trailers) {
                        // nothing worth formatting
                        pendingTable = [tableModel]
                      } else {
                        // some trailing strings worth formatting
                        pendingTable = [tableModel, trailers]
                      }
                    } else {
                      // no trailing strings
                      pendingTable = [tableModel]
                    }
                  } else if (raw.length > 1000) {
                    definitelyNotTable = true
                  }
                } else {
                  debug('definitelyNotTable')
                  definitelyNotTable = true
                }
              } catch (err) {
                console.error('error parsing as table', err)
                definitelyNotTable = true
              }
            }

            if (pendingTable || expectingSemiStructuredOutput) {
              // the above is taking care of this
            } else if (maybeUsage) {
              debug('pending usage')
              pendingUsage = true
            } else {
              if (raw.length > 500) {
                definitelyNotUsage = true
              } else if (raw.length > 1500) {
                definitelyNotTable = true
              }

              if (execOptions.type !== Commands.ExecType.Nested || execOptions.quiet === false) {
                pendingWrites++
                definitelyNotUsage = true
                bytesWereWritten = true
                sawCode = /File exists/i.test(raw)
                  ? 409
                  : /no such/i.test(raw) || /not found/i.test(raw)
                  ? 404
                  : sawCode
                for (let idx = 0; idx < msg.data.length; idx++) {
                  if (msg.data[idx] === '\n') {
                    nLinesRaw++
                  }
                }
                terminal.write(msg.data)
                raw = ''
              }
            }
          } else if (msg.type === 'exit') {
            // server told us that it is done with msg.exitCode
            if (pendingTable && !pendingTable.some(_ => Tables.isTable(_) && _.body.length > 0)) {
              if (execOptions.type !== Commands.ExecType.Nested || execOptions.quiet === false) {
                bytesWereWritten = true
                sawCode = /File exists/i.test(raw)
                  ? 409
                  : /no such/i.test(raw) || /not found/i.test(raw)
                  ? 404
                  : sawCode
                terminal.write(raw)
                raw = ''
              }
              pendingTable = undefined
            }

            /** emit our final response and return control to the repl */
            const respondToRepl = () => {
              if (pendingUsage) {
                execOptions.stdout(
                  formatUsage(cmdline, stripClean(raw), {
                    drilldownWithPip: true
                  })
                )
                xtermContainer.classList.add('xterm-invisible')
              } else if (pendingTable) {
                const response = pendingTable
                execOptions.stdout(response.length === 1 ? response[0] : response)
              } else if (expectingSemiStructuredOutput) {
                try {
                  const resource =
                    contentType === 'yaml' ? safeLoadWithCatch(stripClean(raw)) : JSON.parse(stripClean(raw))

                  if (typeof resource === 'string') {
                    // degenerate case e.g. cat foo.json | jq .something.something => string rather than struct
                    execOptions.stdout(resource)
                  } else {
                    execOptions.stdout({
                      type: 'custom',
                      isEntity: true,
                      name:
                        argvNoOptions[0] === 'cat' ? path.basename(argvNoOptions[1]) : argvNoOptions.slice(3).join(' '),
                      packageName: argvNoOptions[0] === 'cat' && path.dirname(argvNoOptions[1]),
                      prettyType: argvNoOptions[0] === 'cat' ? contentType : argvNoOptions[2],
                      contentType,
                      content: stripClean(raw),
                      resource,
                      modes: [{ mode: 'raw', direct: cmdline, defaultMode: true }]
                    })
                  }
                } catch (err) {
                  console.error('error parsing as semi structured output')
                  console.error(stripClean(raw))
                  execOptions.stdout(stripClean(raw))
                }
              }

              // vi, then :wq, then :q, you will get an exit code of
              // 1, but with no output (!bytesWereWritten); note how
              // we treat this as "ok", i.e. no error thrown
              if (msg.exitCode !== 0 && bytesWereWritten) {
                const error = new Error('')
                if (sawCode === 409) error['code'] = 409
                // re: i18n, this is for tests
                else if (msg.exitCode !== 127 && sawCode === 404) error['code'] = 404
                // re: i18n, this is for tests
                else error['code'] = msg.exitCode

                if (msg.exitCode === 127) {
                  xtermContainer.classList.add('hide')
                } else {
                  error['hide'] = true
                }

                reject(error)
              } else {
                if (queuedInput && queuedInput.length > 0) {
                  pasteQueuedInput(queuedInput)
                }

                resolve(true)
              }
            }

            /** called after final resize */
            const finishUpAfterFinalResize = () => {
              clearInterval(scrollPoll)
              doScroll()

              ws.removeEventListener('message', onMessage)
              cleanUpTerminal()

              // grab a copy of the terminal now that it has terminated;
              // see https://github.com/IBM/kui/issues/1393
              const copy = terminal.element.cloneNode(true) as HTMLElement
              squash(copy)
              copy.querySelector('.xterm-viewport').remove()
              copy.querySelector('.xterm-helpers').remove()
              copy.querySelector('.xterm-selection').remove()
              const styles = copy.querySelectorAll('style')
              for (let idx = 0; idx < styles.length; idx++) {
                styles[idx].remove()
              }
              copy.classList.remove('enable-mouse-events')
              resizer.reflowLineWraps(copy)
              resizer.hideTrailingEmptyBlanks(true, copy)
              Resizer.hideCursorOnlyRow(copy)

              xtermContainer.removeChild(terminal.element)
              xtermContainer.appendChild(copy)

              // respond to the REPL
              respondToRepl()
            }

            /** called after final refresh */
            const finishUp = () => {
              const nLines = terminal.buffer.length

              if (resizer.wasEverInAltBufferMode() || (nLines <= terminal.rows && nLinesRaw < terminal.rows)) {
                // no need to resize: output is shorter than viewport
                setTimeout(finishUpAfterFinalResize, 50)
              } else {
                // resize the terminal to house the expected number of
                // lines, then wait for the final refresh event that will
                // be sent after the resize has manifested in the DOM
                terminal.off('refresh', onRefresh)
                terminal.on('refresh', finishUpAfterFinalResize)
                terminal.resize(terminal.cols, nLines)
              }
            }

            const nLines = terminal.buffer.length

            doScroll()
            if (pendingWrites > 0) {
              if (!resizer.wasEverInAltBufferMode() && nLines <= terminal.rows && nLinesRaw < terminal.rows) {
                cbAfterPendingWrites = finishUp
              } else {
                // re: setTimeout, this is the same refresh issue
                // discussed in the next comment
                cbAfterPendingWrites = () => setTimeout(finishUp, 50)
              }
            } else {
              // there seems to be a 10% chance that the 'refresh' event
              // is sent to us while there is still pending information
              // flowing over the Channel; we need to get more
              // sophisticated here, but a small delay will help, for
              // the time being.
              if (nLines <= terminal.rows && nLinesRaw < terminal.rows) {
                setTimeout(finishUp, 100)
              } else {
                setTimeout(finishUp, 400)
              }
            }
          }
        }

        ws.on('message', onMessage)
      } catch (error) {
        const err = error as Errors.CodedError
        if (err.code === 127 || err.code === 404) {
          err.code = 127
          reject(err)
        } else {
          if (err.code !== 503) {
            // don't bother complaining too much about connection refused
            debug('error in pty/client', err)
          }

          if (!err.message) {
            err.message = 'Internal Error'
          }

          reject(err)
        }
      }
    }

    if (injectingCSS) {
      // do the main work after injectCSS
      setTimeout(exec, 0)
    } else {
      // otherwise, we are good to go
      exec()
    }
  })
