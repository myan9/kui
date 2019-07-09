/*
 * Copyright 2017-18 IBM Corporation
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

import * as Debug from 'debug'

import { Tab, isPopup, getCurrentPrompt } from '../cli'
import { pexec, qexec } from '../../core/repl'
import drilldown from '../picture-in-picture'
import {
  Table,
  MultiTable,
  Row,
  Cell,
  Icon,
  TableStyle,
  WatchableTable,
  diffTableRows,
  isWatchableTable,
  WatchableMultiTable,
  isWatchableMultiTable,
  isMultiTable,
  isTable
} from '../models/table'
import { applyDiffTable } from '../views/diffTable'
import { theme } from '@kui-shell/core/core/settings'

const debug = Debug('webapp/views/table')

interface TableFormatOptions {
  usePip?: boolean
}

// sort the body of table
export const sortBody = (rows: Row[]): Row[] => {
  return rows.sort(
    (a, b) =>
      (a.prettyType || a.type || '').localeCompare(
        b.prettyType || b.type || ''
      ) ||
      (a.packageName || '').localeCompare(b.packageName || '') ||
      a.name.localeCompare(b.name)
  )
}

/**
 * get an array of row models
 *
 */

const prepareTable = (tab: Tab, response: Table | WatchableTable): Row[] => {
  const { header, body, noSort } = response

  if (header) {
    header.outerCSS = `${header.outerCSS || ''} header-cell`

    if (header.attributes) {
      header.attributes.forEach(cell => {
        cell.outerCSS = `${cell.outerCSS || ''} header-cell`
      })
    }
  }
  // sort the list, then format each element, then add the results to the resultDom
  // (don't sort lists of activations. i wish there were a better way to do this)
  return [header].concat(noSort ? body : sortBody(body)).filter(x => x)
}

/**
 * Format one row in the table
 *
 */
export const formatOneRowResult = (
  tab: Tab,
  options: RowFormatOptions = {}
) => (entity: Row): HTMLElement => {
  // debug('formatOneRowResult', entity)
  const dom = document.createElement('div')
  dom.className = `entity ${entity.prettyType || ''} ${entity.type}`
  dom.setAttribute('data-name', entity.name)

  // row selection
  entity.setSelected = () => {
    const currentSelection = dom.parentNode.querySelector(
      '.selected-row'
    ) as HTMLElement
    if (currentSelection) {
      currentSelection.classList.remove('selected-row')
    }
    dom.querySelector('.row-selection-context').classList.add('selected-row')
    getCurrentPrompt().focus()
  }
  entity.setUnselected = () => {
    dom.querySelector('.row-selection-context').classList.remove('selected-row')
  }

  if (entity.packageName) {
    dom.setAttribute('data-package-name', entity.packageName)
  }

  const entityName = document.createElement('div')
  entityName.className = 'entity-attributes row-selection-context'
  dom.appendChild(entityName)

  if (entity.rowCSS) {
    if (Array.isArray(entity.rowCSS)) {
      entity.rowCSS.forEach(_ => _ && entityName.classList.add(_))
    } else {
      entityName.classList.add(entity.rowCSS)
    }
  }

  // now add the clickable name
  const entityNameGroup = document.createElement('span')
  entityNameGroup.className = `entity-name-group ${entity.outerCSS}`
  if (entityNameGroup.classList.contains('header-cell')) {
    entityName.classList.add('header-row')
    ;(entityName.parentNode as HTMLElement).classList.add('header-row')
  }
  if ((!options || !options.excludePackageName) && entity.packageName) {
    const packagePrefix = document.createElement('span')
    packagePrefix.className = 'package-prefix lighter-text smaller-text'
    packagePrefix.innerText = entity.packageName + '/'
    entityNameGroup.appendChild(packagePrefix)
  }
  const entityNameClickable = document.createElement('span')
  entityNameClickable.className = 'entity-name'
  if (!entityNameGroup.classList.contains('header-cell')) {
    entityNameClickable.classList.add('clickable')
  }
  if (entity.nameCss) {
    if (Array.isArray(entity.nameCss)) {
      entity.nameCss.forEach(_ => entityNameClickable.classList.add(_))
    } else {
      entityNameClickable.classList.add(entity.nameCss)
    }
  }
  entityNameGroup.appendChild(entityNameClickable)
  entityName.appendChild(entityNameGroup)

  if (entity.key) {
    entityNameClickable.setAttribute('data-key', entity.key)
  } else {
    // if we have no key field, and this is the first column, let us
    // use NAME as the default key; e.g. we style NAME columns
    // slightly differently
    entityNameClickable.setAttribute('data-key', 'NAME')
  }

  // name of the entity
  const name = entity.prettyName || entity.name

  // click handler for the list result
  if (entity.fontawesome) {
    const icon = document.createElement('i')
    entityNameClickable.appendChild(icon)
    icon.className = entity.fontawesome
    icon.classList.add('cell-inner')
  } else if (typeof name === 'string') {
    entityNameClickable.title = name
    entityNameClickable.innerText = name
  } else {
    entityNameClickable.appendChild(name)
  }

  entityNameClickable.setAttribute('data-value', name) // in case tests need the actual value, not the icon
  if (entity.fullName) {
    entityNameClickable.setAttribute('title', entity.fullName)
  }

  if (entity.css) {
    if (Array.isArray(entity.css)) {
      entity.css.forEach(_ => entityNameClickable.classList.add(_))
    } else {
      entityNameClickable.classList.add(entity.css)
    }
  }
  if (!entity.onclick) {
    // the provider has told us the entity name is not clickable
    entityNameClickable.classList.remove('clickable')
  } else {
    if (isPopup() || options.usePip) {
      entityNameClickable.onclick = evt => {
        return drilldown(
          tab,
          entity.onclick,
          undefined,
          '.custom-content .padding-content',
          'previous view'
        )(evt)
      }
    } else if (typeof entity.onclick === 'string') {
      entityNameClickable.onclick = () => pexec(entity.onclick, { tab })
    } else {
      entityNameClickable.onclick = entity.onclick
    }
  }

  /** add a cell to the current row of the table view we are generating. "entityName" is the current row */
  const addCellToRow = (theCell: Cell) => {
    const {
      className,
      value,
      valueDom,
      innerClassName = '',
      parent = entityName,
      onclick,
      watch,
      key,
      fontawesome,
      css = '',
      watchLimit = 100000,
      tag = 'span',
      tagClass
    } = theCell
    const cell = document.createElement('span')
    const inner = document.createElement(tag)

    cell.className = className

    inner.className = innerClassName
    inner.classList.add('cell-inner')
    if (tagClass) {
      inner.classList.add(tagClass)
    }

    if (key) {
      inner.setAttribute('data-key', key)
    }

    if (css) {
      inner.classList.add(css)
    }

    if (fontawesome) {
      const addIcon = (theIcon: Icon) => {
        const icon = document.createElement('i')
        icon.className = theIcon.fontawesome
        icon.classList.add('cell-inner')

        if (typeof onclick === 'function') {
          icon.onclick = onclick
          icon.classList.add('clickable')
        }

        if (theIcon.balloon) {
          // tooltip; careful: both balloon and fontawesome want to
          // use :before and :after; so we need a wrapper
          const iconWrapper = document.createElement('span')
          iconWrapper.setAttribute('data-balloon', theIcon.balloon)
          iconWrapper.setAttribute(
            'data-balloon-pos',
            theIcon.balloonPos || 'right'
          )
          if (theIcon.balloonLength) {
            iconWrapper.setAttribute(
              'data-balloon-length',
              theIcon.balloonLength
            )
          }
          iconWrapper.appendChild(icon)
          inner.appendChild(iconWrapper)
        } else {
          inner.appendChild(icon)
        }
      }

      if (Array.isArray(fontawesome)) {
        // for an array of icons, keep them centered
        cell.classList.add('text-center')
        cell.classList.add('larger-text')
        fontawesome.forEach(font => addIcon({ fontawesome: font }))
      } else {
        addIcon({ fontawesome })
        inner.setAttribute('data-value', value) // in case tests need the actual value, not the icon
      }
    } else if (valueDom) {
      // array of dom elements
      if (Array.isArray(valueDom)) {
        const container = valueDom.reduce((container, node) => {
          container.appendChild(node)
          return container
        }, document.createElement('div'))

        inner.appendChild(container)
      } else {
        Promise.resolve(valueDom).then(valueDom =>
          inner.appendChild(
            valueDom.nodeName
              ? valueDom
              : document.createTextNode(valueDom.toString())
          )
        )
      }
    } else if (value) {
      Promise.resolve(value).then(value => {
        inner.title = value
        inner.appendChild(document.createTextNode(value))
      })
    } else {
      console.error('Invalid cell model, no value field')
    }
    cell.appendChild(inner)
    parent.appendChild(cell)

    if (cell.classList.contains('header-cell')) {
      parent.classList.add('header-row')
      ;(parent.parentNode as HTMLElement).classList.add('header-row')
    }

    if (onclick) {
      cell.classList.add('clickable')
      cell.onclick = evt => {
        evt.stopPropagation() // don't trickle up to the row click handler
        if (isPopup() || options.usePip) {
          return drilldown(
            tab,
            onclick,
            undefined,
            '.custom-content .padding-content',
            'previous view'
          )(evt)
        } else if (typeof onclick === 'string') {
          // TODO: define types here carefully
          pexec(onclick, { tab })
        } else {
          onclick(evt)
        }
      }
    }

    const pulse = 'repeating-pulse'
    if (
      key === 'STATUS' &&
      (css.includes('yellow-background') ||
        innerClassName.includes('yellow-background'))
    ) {
      cell.classList.add(pulse)
    }

    if (watch) {
      cell.classList.add(pulse)

      // we'll ping the watcher at most watchLimit times
      let count = watchLimit

      // the current watch interval; used for clear/reset/stop
      let interval

      // are we currently slowPolling?
      let slowPolling = false

      const stopWatching = () => {
        debug('stopWatching')
        clearInterval(interval)
        cell.classList.remove(pulse)
      }

      // if we are presenting in popup mode, then when the sidecar is
      // replaced, also terminate watching
      // revisit this when we can handle restoring after a back and forth
      /* if (isPopup()) {
        eventBus.once('/sidecar/replace', stopWatching)
      } */

      /** the watch interval handler */
      const watchIt = () => {
        if (--count < 0) {
          debug('watchLimit exceeded', value)
          stopWatching()
          return
        }

        try {
          Promise.resolve(watch(watchLimit - count - 1)).then(
            ({
              value,
              done = false,
              css,
              onclick,
              others = [],
              unchanged = false,
              outerCSS,
              slowPoll = false
            }) => {
              if (unchanged) {
                // nothing to do, yet
                return
              }

              // debug('watch update', done)
              // stopWatching()

              // are we done polling for updates?
              if (value === null || value === undefined || done) {
                stopWatching()
              }

              // update onclick
              if (onclick) {
                debug('updating onclick', entity.onclick)
                entityNameClickable.classList.add('clickable')
                if (typeof onclick === 'string') {
                  entityNameClickable.onclick = () => {
                    return pexec(onclick, { tab })
                  }
                } else {
                  entityNameClickable.onclick = onclick
                }
              }

              // update the styling
              if (css) {
                inner.className = css
              }

              // update the outer styling i.e. of the table cell
              if (outerCSS !== undefined && outerCSS !== false) {
                const isPulsing = cell.classList.contains(pulse)
                cell.className = outerCSS
                if (isPulsing) {
                  cell.classList.add(pulse)
                }
              }

              // update the text
              if (value) {
                inner.innerText = ''
                inner.appendChild(
                  value.nodeName
                    ? value
                    : document.createTextNode(value.toString())
                )
              }

              // any other cells to update?
              others.forEach(({ key, value, css, fontawesome }) => {
                const otherInner = parent.querySelector(
                  `.cell-inner[data-key="${key}"]`
                ) as HTMLElement
                if (otherInner) {
                  otherInner.setAttribute('data-value', value)
                  if (css) {
                    otherInner.className = `cell-inner ${css}`
                  }
                  if (fontawesome) {
                    otherInner.querySelector('i').className = fontawesome
                  } else {
                    otherInner.innerText = ''
                    otherInner.appendChild(
                      value.nodeName
                        ? value
                        : document.createTextNode(value.toString())
                    )
                  }
                }
              })

              // here we manage the slowPoll transitions
              if (slowPoll) {
                // the model provider has requested a new, "slow polling" watch
                if (!slowPolling) {
                  debug('entering slowPoll mode', slowPoll)
                  slowPolling = true
                  stopWatching() // this will remove the "pulse" effect, which is what we want
                  interval = setInterval(watchIt, slowPoll) // this will NOT re-establish the pulse, which is also what we want
                }
              } else if (slowPolling) {
                // we were told not to slowPoll, but we are currently
                // slowPolling, and so we exit slowPoll mode
                debug('exiting slowPoll mode')
                slowPolling = false
                cell.classList.add(pulse)
                clearInterval(interval)
                interval = setInterval(watchIt, 1000 + ~~(1000 * Math.random()))
              }
            }
          )
        } catch (err) {
          console.error('Error watching value', err)
          clearInterval(interval)
          cell.classList.remove(pulse)
        }
      }

      // establish the initial watch interval
      interval = setInterval(watchIt, 1000 + ~~(1000 * Math.random()))
    }

    return cell
  }

  // add any attributes that should appear *before* the name column
  if (entity.beforeAttributes) {
    entity.beforeAttributes.forEach(
      ({ key, value, css = '', outerCSS = '', onclick, fontawesome }) =>
        addCellToRow({
          className: outerCSS,
          value,
          innerClassName: css,
          onclick,
          key,
          fontawesome
        })
    )
  }

  //
  // case-specific cells
  //
  if (entity.attributes) {
    // the entity provider wants to take complete control
    entity.attributes.forEach(
      ({
        key,
        value,
        css = '',
        outerCSS = '',
        watch,
        watchLimit,
        onclick,
        fontawesome,
        tag
      }) => {
        addCellToRow({
          className: outerCSS,
          value,
          innerClassName: css,
          onclick,
          watch,
          key,
          fontawesome,
          watchLimit,
          tag
        })
      }
    )
  } else {
    // otherwise, we have some generic attribute handlers, here
    const addKind = () => {
      if (entity.kind || entity.prettyKind) {
        addCellToRow({
          className: 'entity-kind',
          value: entity.prettyKind || entity.kind
        })
      }
    }
    const addStatus = () => {
      if (entity.status) {
        const cell = addCellToRow({
          className: `entity-rule-status`,
          value: 'Pending', // delay status display
          innerClassName: 'repeating-pulse', // css
          tag: 'badge',
          tagClass: 'gray-background'
        })

        /** normalize the status badge by capitalization */
        const capitalize = (str: string): string => {
          return str[0].toUpperCase() + str.slice(1).toLowerCase()
        }

        Promise.resolve(entity.status).then(status => {
          const badge = cell.querySelector('badge') as HTMLElement
          badge.innerText = capitalize(status)
          badge.classList.remove('gray-background')
          badge.classList.add(
            status === 'active' ? 'green-background' : 'red-background'
          )
          badge.classList.remove('repeating-pulse')
        })
      }
    }
    const addVersion = () => {
      if (entity.version || entity.prettyVersion) {
        addCellToRow({
          className: 'entity-version hide-with-sidecar',
          value: entity.prettyVersion || entity.version,
          innerClassName: 'slightly-deemphasize'
        })
      }
    }

    addKind()
    addStatus()
    addVersion()
  }

  return dom
}

/**
 * Set the table style attribute for the given table container
 *
 */
function setStyle(tableDom: HTMLElement, table: Table) {
  if (table.style !== undefined) {
    tableDom.setAttribute('kui-table-style', TableStyle[table.style].toString())
  } else if (theme.tableStyle) {
    tableDom.setAttribute('kui-table-style', theme.tableStyle)
  }
}

// This helps multi-table view handler to use the the processed data from single-table view handler
interface TableViewInfo {
  renderedRows: HTMLElement[]
  rowsModel: Row[]
  renderedTable: HTMLElement
  tableModel: Table | WatchableTable
}

export const formatTable = (
  tab: Tab,
  table: Table | WatchableTable,
  resultDom: HTMLElement,
  options: TableFormatOptions = {}
): TableViewInfo => {
  const tableDom = document.createElement('div')
  tableDom.classList.add('result-table')

  let container: HTMLElement
  if (table.title) {
    const tableOuterWrapper = document.createElement('div')
    const tableOuter = document.createElement('div')
    const titleOuter = document.createElement('div')
    const titleInner = document.createElement('div')

    tableOuterWrapper.classList.add('result-table-outer-wrapper')
    tableOuter.appendChild(titleOuter)
    titleOuter.appendChild(titleInner)
    tableOuterWrapper.appendChild(tableOuter)
    resultDom.appendChild(tableOuterWrapper)

    if (table.flexWrap) {
      const tableScroll = document.createElement('div')
      tableScroll.classList.add('scrollable')
      tableScroll.classList.add('scrollable-auto')
      tableScroll.setAttribute(
        'data-table-max-rows',
        typeof table.flexWrap === 'number' ? table.flexWrap.toString() : '8'
      )
      tableScroll.appendChild(tableDom)
      tableOuter.appendChild(tableScroll)
    } else {
      tableOuter.appendChild(tableDom)
    }

    tableOuter.classList.add('result-table-outer')
    titleOuter.classList.add('result-table-title-outer')
    titleInner.classList.add('result-table-title')
    titleInner.innerText = table.title

    if (table.tableCSS) {
      tableOuterWrapper.classList.add(table.tableCSS)
    }

    if (table.fontawesome) {
      const awesomeWrapper = document.createElement('div')
      const awesome = document.createElement('i')
      awesomeWrapper.appendChild(awesome)
      titleOuter.appendChild(awesomeWrapper)

      awesome.className = table.fontawesome

      if (table.fontawesomeCSS) {
        awesomeWrapper.classList.add(table.fontawesomeCSS)
        delete table.fontawesomeCSS
      }

      if (table.fontawesomeBalloon) {
        awesomeWrapper.setAttribute('data-balloon', table.fontawesomeBalloon)
        awesomeWrapper.setAttribute('data-balloon-pos', 'left')
        delete table.fontawesomeBalloon
      }

      // otherwise, the header row renderer will pick this up
      delete table.fontawesome
    }

    container = tableOuterWrapper
  } else {
    resultDom.appendChild(tableDom)
    container = tableDom
  }

  container.classList.add('big-top-pad')

  const prepareRows = prepareTable(tab, table)
  const rows = prepareRows.map(formatOneRowResult(tab, options))
  rows.map(row => tableDom.appendChild(row))

  setStyle(tableDom, table)

  const rowSelection = tableDom.querySelector('.selected-row')
  if (rowSelection) {
    tableDom.classList.add('has-row-selection')
  }

  if (isWatchableTable(table)) {
    if (table.watchByDefault) {
      // TODO: register a button?
      // we'll ping the watcher at most watchLimit times
      let count = table.watchLimit ? table.watchLimit : 100000

      // the current watch interval; used for clear/reset/stop
      let interval: NodeJS.Timeout // eslint-disable-line prefer-const

      const stopWatching = () => {
        debug('stopWatching')
        clearInterval(interval)
      }

      const refreshTable = async () => {
        debug(`refresh with ${table.refreshCommand}`)

        let newPrepareRows: Row[]

        try {
          const response = await qexec(table.refreshCommand)
          if (isTable(response)) {
            newPrepareRows = prepareTable(tab, response)

            if (!response.body.some(row => !row.done)) {
              // stop watching if all resources have reached to the finial state
              stopWatching()
            }
          } else {
            console.error('refresh result is not a table', response)
            rows.map(row => tableDom.removeChild(row))
          }
        } catch (err) {
          if (err.code === 404) {
            if (table.refreshCommand.includes('--final-state 2')) {
              debug(
                'resource not found after status check, but that is ok because that is what we wanted'
              )
              stopWatching()
            }
            newPrepareRows = []
          } else {
            while (resultDom.firstChild) {
              resultDom.removeChild(resultDom.firstChild)
            }
            stopWatching()
            throw err
          }
        }

        const diffs = diffTableRows(prepareRows, newPrepareRows)
        // debug('diff table rows', diffs)
        applyDiffTable(diffs, tab, tableDom, rows, prepareRows)
      }

      const watchIt = () => {
        if (--count < 0) {
          debug('watchLimit exceeded')
          stopWatching()
          return
        }

        try {
          Promise.resolve(refreshTable())
        } catch (err) {
          console.error('Error refreshing table', err)
          clearInterval(interval)
        }
      }

      // establish the initial watch interval
      interval = setInterval(watchIt, 1000 + ~~(1000 * Math.random()))
    }
  }
  return {
    renderedRows: rows,
    renderedTable: tableDom,
    rowsModel: prepareRows,
    tableModel: table
  }
}

interface RowFormatOptions extends TableFormatOptions {
  excludePackageName?: boolean
}

/**
 * Format one row in the table
 * @deprecated in favor of new formatOneRowResult()
 *
 */
export const formatOneListResult = (tab: Tab, options?) => entity => {
  const dom = document.createElement('div')
  dom.className = `entity ${entity.prettyType || ''} ${entity.type}`
  dom.setAttribute('data-name', entity.name)

  // row selection
  entity.setSelected = () => {
    const currentSelection = dom.parentNode.querySelector(
      '.selected-row'
    ) as HTMLElement
    if (currentSelection) {
      currentSelection.classList.remove('selected-row')
    }
    dom.querySelector('.row-selection-context').classList.add('selected-row')
    getCurrentPrompt().focus()
  }
  entity.setUnselected = () => {
    dom.querySelector('.row-selection-context').classList.remove('selected-row')
  }

  if (entity.packageName) {
    dom.setAttribute('data-package-name', entity.packageName)
  }

  const entityName = document.createElement('div')
  entityName.className = 'entity-attributes row-selection-context'
  dom.appendChild(entityName)

  if (entity.rowCSS) {
    if (Array.isArray(entity.rowCSS)) {
      entity.rowCSS.forEach(_ => _ && entityName.classList.add(_))
    } else {
      entityName.classList.add(entity.rowCSS)
    }
  }

  // now add the clickable name
  const entityNameGroup = document.createElement('span')
  entityNameGroup.className = `entity-name-group ${entity.outerCSS}`
  if (entityNameGroup.classList.contains('header-cell')) {
    entityName.classList.add('header-row')
    ;(entityName.parentNode as HTMLElement).classList.add('header-row')
  }
  if ((!options || !options.excludePackageName) && entity.packageName) {
    const packagePrefix = document.createElement('span')
    packagePrefix.className = 'package-prefix lighter-text smaller-text'
    packagePrefix.innerText = entity.packageName + '/'
    entityNameGroup.appendChild(packagePrefix)
  }
  const entityNameClickable = document.createElement('span')
  entityNameClickable.className = 'entity-name'
  if (!entityNameGroup.classList.contains('header-cell')) {
    entityNameClickable.classList.add('clickable')
  }
  if (entity.nameCss) {
    if (Array.isArray(entity.nameCss)) {
      entity.nameCss.forEach(_ => entityNameClickable.classList.add(_))
    } else {
      entityNameClickable.classList.add(entity.nameCss)
    }
  }
  entityNameGroup.appendChild(entityNameClickable)
  entityName.appendChild(entityNameGroup)

  if (entity.key) {
    entityNameClickable.setAttribute('data-key', entity.key)
  } else {
    // if we have no key field, and this is the first column, let us
    // use NAME as the default key; e.g. we style NAME columns
    // slightly differently
    entityNameClickable.setAttribute('data-key', 'NAME')
  }

  // name of the entity
  const name = entity.prettyName || entity.name

  // click handler for the list result
  if (entity.fontawesome) {
    const icon = document.createElement('i')
    entityNameClickable.appendChild(icon)
    icon.className = entity.fontawesome
    icon.classList.add('cell-inner')
  } else if (typeof name === 'string') {
    entityNameClickable.title = name
    entityNameClickable.innerText = name
  } else {
    entityNameClickable.appendChild(name)
  }

  entityNameClickable.setAttribute('data-value', name) // in case tests need the actual value, not the icon
  if (entity.fullName) {
    entityNameClickable.setAttribute('title', entity.fullName)
  }

  if (entity.css) {
    if (Array.isArray(entity.css)) {
      entity.css.forEach(_ => entityNameClickable.classList.add(_))
    } else {
      entityNameClickable.classList.add(entity.css)
    }
  }
  if (entity.onclick === false) {
    // the provider has told us the entity name is not clickable
    entityNameClickable.classList.remove('clickable')
  } else {
    if (isPopup()) {
      entityNameClickable.onclick = evt => {
        return drilldown(
          tab,
          entity.onclick,
          undefined,
          '.custom-content .padding-content',
          'previous view'
        )(evt)
      }
    } else if (typeof entity.onclick === 'string') {
      entityNameClickable.onclick = () => pexec(entity.onclick, { tab })
    } else {
      entityNameClickable.onclick = entity.onclick
    }
  }

  /** add a cell to the current row of the list view we] are generating. "entityName" is the current row */
  const addCell = (
    className,
    value,
    innerClassName = '',
    parent = entityName,
    onclick?,
    watch?,
    key?,
    fontawesome?,
    css?,
    watchLimit = 100000,
    tag = 'span',
    tagClass?: string
  ) => {
    const cell = document.createElement('span')
    const inner = document.createElement(tag)

    cell.className = className

    inner.className = innerClassName
    inner.classList.add('cell-inner')
    if (tagClass) {
      inner.classList.add(tagClass)
    }

    if (key) {
      inner.setAttribute('data-key', key)
    }

    if (css) {
      inner.classList.add(css)
    }

    if (fontawesome) {
      const addIcon = ({
        fontawesome,
        onclick = undefined,
        balloon = undefined,
        balloonLength = undefined,
        balloonPos = 'right'
      }) => {
        const icon = document.createElement('i')
        icon.className = fontawesome
        icon.classList.add('cell-inner')

        if (onclick) {
          icon.onclick = onclick
          icon.classList.add('clickable')
        }

        if (balloon) {
          // tooltip; careful: both balloon and fontawesome want to
          // use :before and :after; so we need a wrapper
          const iconWrapper = document.createElement('span')
          iconWrapper.setAttribute('data-balloon', balloon)
          iconWrapper.setAttribute('data-balloon-pos', balloonPos)
          if (balloonLength) {
            iconWrapper.setAttribute('data-balloon-length', balloonLength)
          }
          iconWrapper.appendChild(icon)
          inner.appendChild(iconWrapper)
        } else {
          inner.appendChild(icon)
        }
      }
      if (Array.isArray(fontawesome)) {
        // for an array of icons, keep them centered
        cell.classList.add('text-center')
        cell.classList.add('larger-text')
        fontawesome.forEach(addIcon)
      } else {
        addIcon({ fontawesome })
        inner.setAttribute('data-value', value) // in case tests need the actual value, not the icon
      }
    } else if (Array.isArray(value) && value[0] && value[0].nodeName) {
      // array of dom elements
      const container = value.reduce((container, node) => {
        container.appendChild(node)
        return container
      }, document.createElement('div'))

      inner.appendChild(container)
    } else if (value !== undefined) {
      Promise.resolve(value).then(value =>
        inner.appendChild(
          value.nodeName ? value : document.createTextNode(value.toString())
        )
      )
    } else {
      console.error('Invalid cell model, no value field')
    }
    cell.appendChild(inner)
    parent.appendChild(cell)

    if (cell.classList.contains('header-cell')) {
      parent.classList.add('header-row')
      ;(parent.parentNode as HTMLElement).classList.add('header-row')
    }

    if (onclick) {
      cell.classList.add('clickable')
      cell.onclick = evt => {
        evt.stopPropagation() // don't trickle up to the row click handler
        if (isPopup()) {
          return drilldown(
            tab,
            onclick,
            undefined,
            '.custom-content .padding-content',
            'previous view'
          )(evt)
        } else if (typeof onclick === 'string') {
          pexec(onclick, { tab })
        } else {
          onclick(evt)
        }
      }
    }

    if (watch) {
      const pulse = 'repeating-pulse'
      cell.classList.add(pulse)

      // we'll ping the watcher at most watchLimit times
      let count = watchLimit

      // the current watch interval; used for clear/reset/stop
      let interval

      // are we currently slowPolling?
      let slowPolling = false

      const stopWatching = () => {
        debug('stopWatching')
        clearInterval(interval)
        cell.classList.remove(pulse)
      }

      // if we are presenting in popup mode, then when the sidecar is
      // replaced, also terminate watching
      // revisit this when we can handle restoring after a back and forth
      /* if (isPopup()) {
        eventBus.once('/sidecar/replace', stopWatching)
      } */

      /** the watch interval handler */
      const watchIt = () => {
        if (--count < 0) {
          debug('watchLimit exceeded', value)
          stopWatching()
          return
        }

        try {
          Promise.resolve(watch(watchLimit - count - 1)).then(
            ({
              value,
              done = false,
              css,
              onclick,
              others = [],
              unchanged = false,
              outerCSS,
              slowPoll = false
            }) => {
              if (unchanged) {
                // nothing to do, yet
                return
              }

              // debug('watch update', done)
              // stopWatching()

              // are we done polling for updates?
              if (value === null || value === undefined || done) {
                stopWatching()
              }

              // update onclick
              if (onclick) {
                debug('updating onclick', entity.onclick)
                entityNameClickable.classList.add('clickable')
                if (typeof onclick === 'string') {
                  entityNameClickable.onclick = () => {
                    return pexec(onclick, { tab })
                  }
                } else {
                  entityNameClickable.onclick = onclick
                }
              }

              // update the styling
              if (css) {
                inner.className = css
              }

              // update the outer styling i.e. of the table cell
              if (outerCSS !== undefined && outerCSS !== false) {
                const isPulsing = cell.classList.contains(pulse)
                cell.className = outerCSS
                if (isPulsing) {
                  cell.classList.add(pulse)
                }
              }

              // update the text
              if (value) {
                inner.innerText = ''
                inner.appendChild(
                  value.nodeName
                    ? value
                    : document.createTextNode(value.toString())
                )
              }

              // any other cells to update?
              others.forEach(({ key, value, css, fontawesome }) => {
                const otherInner = parent.querySelector(
                  `.cell-inner[data-key="${key}"]`
                ) as HTMLElement
                if (otherInner) {
                  otherInner.setAttribute('data-value', value)
                  if (css) {
                    otherInner.className = `cell-inner ${css}`
                  }
                  if (fontawesome) {
                    otherInner.querySelector('i').className = fontawesome
                  } else {
                    otherInner.innerText = ''
                    otherInner.appendChild(
                      value.nodeName
                        ? value
                        : document.createTextNode(value.toString())
                    )
                  }
                }
              })

              // here we manage the slowPoll transitions
              if (slowPoll) {
                // the model provider has requested a new, "slow polling" watch
                if (!slowPolling) {
                  debug('entering slowPoll mode', slowPoll)
                  slowPolling = true
                  stopWatching() // this will remove the "pulse" effect, which is what we want
                  interval = setInterval(watchIt, slowPoll) // this will NOT re-establish the pulse, which is also what we want
                }
              } else if (slowPolling) {
                // we were told not to slowPoll, but we are currently
                // slowPolling, and so we exit slowPoll mode
                debug('exiting slowPoll mode')
                slowPolling = false
                cell.classList.add(pulse)
                clearInterval(interval)
                interval = setInterval(watchIt, 1000 + ~~(1000 * Math.random()))
              }
            }
          )
        } catch (err) {
          console.error('Error watching value', err)
          clearInterval(interval)
          cell.classList.remove(pulse)
        }
      }

      // establish the initial watch interval
      interval = setInterval(watchIt, 1000 + ~~(1000 * Math.random()))
    }

    return cell
  }

  // add any attributes that should appear *before* the name column
  if (entity.beforeAttributes) {
    entity.beforeAttributes.forEach(
      ({ key, value, css = '', outerCSS = '', onclick, fontawesome }) =>
        addCell(
          outerCSS,
          value,
          css,
          undefined,
          onclick,
          undefined,
          key,
          fontawesome
        )
    )
  }

  //
  // case-specific cells
  //
  if (entity.attributes) {
    // the entity provider wants to take complete control
    entity.attributes.forEach(
      ({
        key,
        value,
        css = '',
        outerCSS = '',
        watch,
        watchLimit,
        onclick,
        fontawesome,
        tag
      }) => {
        addCell(
          outerCSS,
          value,
          css,
          undefined,
          onclick,
          watch,
          key,
          fontawesome,
          undefined,
          watchLimit,
          tag
        )
      }
    )
  } else {
    // otherwise, we have some generic attribute handlers, here
    const addKind = () => {
      if (entity.kind || entity.prettyKind) {
        addCell('entity-kind', entity.prettyKind || entity.kind)
      }
    }
    const addStatus = () => {
      if (entity.status) {
        const cell = addCell(
          `entity-rule-status`,
          'Pending', // delay status display
          'repeating-pulse', // css
          // ugh: i know, this needs to be cleaned up:
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'badge',
          'gray-background'
        )

        /** normalize the status badge by capitalization */
        const capitalize = (str: string): string => {
          return str[0].toUpperCase() + str.slice(1).toLowerCase()
        }

        Promise.resolve(entity.status).then(status => {
          const badge = cell.querySelector('badge') as HTMLElement
          badge.innerText = capitalize(status)
          badge.classList.remove('gray-background')
          badge.classList.add(
            status === 'active' ? 'green-background' : 'red-background'
          )
          badge.classList.remove('repeating-pulse')
        })
      }
    }
    const addVersion = () => {
      if (entity.version || entity.prettyVersion) {
        addCell(
          'entity-version hide-with-sidecar',
          entity.prettyVersion || entity.version,
          'slightly-deemphasize'
        )
      }
    }

    addKind()
    addStatus()
    addVersion()
  }

  return dom
}

/**
 * Format a tabular view
 *
 */
export const formatTableResult = (tab: Tab, response: Table): HTMLElement[] => {
  debug('formatTableResult', response)
  return prepareTable(tab, response).map(formatOneRowResult(tab))
}

/**
 * Format a tabular view
 * @deprecated in favor of new formatTableResult()
 *
 */
export const formatListResult = (tab: Tab, response) => {
  debug('formatListResult', response)

  // sort the list, then format each element, then add the results to the resultDom
  // (don't sort lists of activations. i wish there were a better way to do this)
  const sort = () => {
    if (response[0] && response[0].noSort) {
      return response
    } else {
      return response.sort(
        (a, b) =>
          (a.prettyType || a.type).localeCompare(b.prettyType || b.type) ||
          (a.packageName || '').localeCompare(b.packageName || '') ||
          a.name.localeCompare(b.name)
      )
    }
  }

  return sort().map(formatOneListResult(tab))
}

export const formatMultiTableResult = (
  tab: Tab,
  response: MultiTable,
  resultDom: HTMLElement
) => {
  const tables = response.tables

  const tableViewInfo =
    tables && tables.map(table => formatTable(tab, table, resultDom))

  if (isWatchableMultiTable(response) && response.watchByDefault) {
    let count = response.watchLimit ? response.watchLimit : 100000

    // the current watch interval; used for clear/reset/stop
    let interval: NodeJS.Timeout // eslint-disable-line prefer-const

    const stopWatching = () => {
      debug('stopWatching')
      clearInterval(interval)
    }

    const refreshTables = async () => {
      debug(`refresh with ${response.refreshCommand}`)

      let newPrepareRows: Row[][]

      try {
        const refreshResult = await qexec(response.refreshCommand)

        if (isMultiTable(refreshResult)) {
          let allDone = true // allDone is used to indicate if all resources have reached to the final state

          newPrepareRows = refreshResult.tables.map(table => {
            if (table.body.some(row => !row.done)) {
              allDone = false
            }
            return prepareTable(tab, table)
          })

          // stop watching if all rows have done the jobs
          if (allDone) {
            stopWatching()
          }
        }
      } catch (err) {
        if (err.code === 404) {
          if (response.refreshCommand.includes('--final-state 2')) {
            debug(
              'resource not found after status check, but that is ok because that is what we wanted'
            )
            stopWatching()
          }
          newPrepareRows = []
        } else {
          while (resultDom.firstChild) {
            resultDom.removeChild(resultDom.firstChild)
          }
          stopWatching()
          throw err
        }
      }

      newPrepareRows.forEach((newRows, index) => {
        const diffs = diffTableRows(tableViewInfo[index].rowsModel, newRows)
        // debug('diff table rows', diffs)
        applyDiffTable(
          diffs,
          tab,
          tableViewInfo[index].renderedTable,
          tableViewInfo[index].renderedRows,
          tableViewInfo[index].rowsModel
        )
      })
    }

    const watchIt = () => {
      if (--count < 0) {
        debug('watchLimit exceeded')
        stopWatching()
        return
      }

      try {
        Promise.resolve(refreshTables())
      } catch (err) {
        console.error('Error refreshing table', err)
        clearInterval(interval)
      }
    }

    // establish the initial watch interval
    interval = setInterval(watchIt, 1000 + ~~(1000 * Math.random()))
  }
}

/**
 * Format a table of tables view
 *
 */
export const formatMultiListResult = async (
  tab: Tab,
  response,
  resultDom: Element
) => {
  debug('formatMultiListResult', response)

  return Promise.all(
    response
      .filter(x => x.length > 0)
      .map(async (table, idx, tables) => {
        const tableDom = document.createElement('div')
        tableDom.classList.add('result-table')

        let container
        if (table[0].title) {
          const tableOuterWrapper = document.createElement('div')
          const tableOuter = document.createElement('div')
          const titleOuter = document.createElement('div')
          const titleInner = document.createElement('div')

          tableOuterWrapper.classList.add('result-table-outer-wrapper')
          if (tables.length > 1) {
            tableOuterWrapper.classList.add('row-selection-context')
          }

          if (table[0].style !== undefined) {
            tableOuter.setAttribute(
              'kui-table-style',
              TableStyle[table[0].style].toString()
            )
          }

          tableOuter.appendChild(titleOuter)
          titleOuter.appendChild(titleInner)
          tableOuterWrapper.appendChild(tableOuter)
          resultDom.appendChild(tableOuterWrapper)

          if (table[0].flexWrap) {
            const tableScroll = document.createElement('div')
            tableScroll.classList.add('scrollable')
            tableScroll.classList.add('scrollable-auto')
            tableScroll.setAttribute(
              'data-table-max-rows',
              typeof table[0].flexWrap === 'number' ? table[0].flexWrap : 8
            )
            tableScroll.appendChild(tableDom)
            tableOuter.appendChild(tableScroll)
          } else {
            tableOuter.appendChild(tableDom)
          }

          tableOuter.classList.add('result-table-outer')
          titleOuter.classList.add('result-table-title-outer')
          titleInner.classList.add('result-table-title')
          titleInner.innerText = table[0].title

          if (table[0].tableCSS) {
            tableOuterWrapper.classList.add(table[0].tableCSS)
          }

          if (table[0].fontawesome) {
            const awesomeWrapper = document.createElement('div')
            const awesome = document.createElement('i')
            awesomeWrapper.appendChild(awesome)
            titleOuter.appendChild(awesomeWrapper)

            awesome.className = table[0].fontawesome

            if (table[0].fontawesomeCSS) {
              awesomeWrapper.classList.add(table[0].fontawesomeCSS)
              delete table[0].fontawesomeCSS
            }

            if (table[0].fontawesomeBalloon) {
              awesomeWrapper.setAttribute(
                'data-balloon',
                table[0].fontawesomeBalloon
              )
              awesomeWrapper.setAttribute('data-balloon-pos', 'left')
              delete table[0].fontawesomeBalloon
            }

            // otherwise, the header row renderer will pick this up
            delete table[0].fontawesome
          }

          container = tableOuterWrapper
        } else {
          resultDom.appendChild(tableDom)
          container = tableDom
        }

        container.classList.add('big-top-pad')

        // render(table, { echo: false, resultDom: tableDom })
        const rows = await formatListResult(tab, table)
        rows.map(row => tableDom.appendChild(row))

        const rowSelection = tableDom.querySelector('.selected-row')
        if (rowSelection) {
          tableDom.classList.add('has-row-selection')
        }
      })
  )
}
