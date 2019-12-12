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
import Debug from 'debug'
import * as minimist from 'yargs-parser'

import { theme } from '../../core/settings'
import { WatchableJob } from '../../core/jobs/job'
import { _split as split, Split } from '../../repl/split'
import { Tab } from '../../webapp/tab'
import {
  prepareTable,
  insertTheRow,
  deleteTheRow,
  udpateTheRow,
  ExistingTableSpec,
  RowFormatOptions
} from '../../webapp/views/table'
import { Row, Table, isTable, diffTableRows } from '../../webapp/models/table'

const debug = Debug('core/jobs/poll')

const fastPolling = 500 // initial polling rate for watching OnlineLike or OfflineLike state
const mediumPolling = 3000 // initial polling rate for watching a steady state
const finalPolling = (theme && theme.tablePollingInterval) || 5000 // final polling rate (do not increase the interval beyond this!)

debug('polling intervals', fastPolling, mediumPolling, finalPolling)

/** groups of States that mark desired final outcomes */
enum FinalState {
  NotPendingLike,
  OnlineLike,
  OfflineLike
}

/**
 * maybe the resources in table have all reach to the final state?
 *
 */
const hasReachedFinalState = (response: Table) => response.body.length !== 0 && response.body.every(row => row.done)

/**
 * find the final state from refresh command
 *
 */
const findFinalStateFromCommand = (command: string): string => {
  // parse the refresh command
  const { A: argv } = split(command, true, true) as Split
  const options = minimist(argv)

  return options['final-state'] ? FinalState[options['finalState']] : ''
}

/**
 * calcuate the polling ladder
 *
 */
const calculateLadder = (initial: number): number[] => {
  const ladder = [initial]
  let current = initial

  // increment the polling interval
  while (current < finalPolling) {
    if (current < 1000) {
      current = current + 250 < 1000 ? current + 250 : 1000
      ladder.push(current)
    } else {
      ladder.push(current)
      current = current + 2000 < finalPolling ? current + 2000 : finalPolling
      ladder.push(current)
    }
  }

  debug('ladder', ladder)
  return ladder
}

/**
 * register a watchable job
 *
 */
export const registerWatcher = (
  tab: Tab,
  watchLimit = 100000,
  command: string,
  resultDom: HTMLElement,
  existingTable: ExistingTableSpec,
  formatRowOption?: RowFormatOptions
) => {
  let job: WatchableJob // eslint-disable-line prefer-const

  // the final state we want to reach to
  const expectedFinalState = findFinalStateFromCommand(command)

  // establish the initial watch interval,
  // if we're on resource creation/deletion, do fast polling, otherwise we do steady polling
  const initalPollingInterval =
    expectedFinalState === 'OfflineLike' || expectedFinalState === 'OnlineLike' ? fastPolling : mediumPolling

  // increase the table polling interval until it reaches the steady polling interval, store the ladder in an array
  const ladder = calculateLadder(initalPollingInterval)

  /**
   * process the refreshed result
   * @return processed Table info: { table: Row[], reachedFinalState: boolean }
   *
   */
  const processRefreshResponse = (response: Table) => {
    if (!isTable(response)) {
      console.error('refresh result is not a table', response)
      throw new Error('refresh result is not a table')
    }

    const reachedFinalState = hasReachedFinalState(response)

    return { table: prepareTable(tab, response), reachedFinalState }
  }

  // execute the refresh command and apply the result
  const refreshTable = async () => {
    debug(`refresh with ${command}`)
    let processedTableRow: Row[] = []

    try {
      const { qexec } = await import('../../repl/exec')
      const response = await qexec<Table>(command)

      const processedResponse = processRefreshResponse(response)

      processedTableRow = processedResponse.table

      // stop watching if all resources in the table reached to the finial state
      if (processedResponse.reachedFinalState) {
        job.abort()
      } else {
        // if the refreshed result doesn't reach the expected state,
        // then we increment the table polling interval by ladder until it reaches the steady polling interval
        const newTimer = ladder.shift()
        if (newTimer) {
          // reshedule the job using new polling interval
          job.abort()
          job = new WatchableJob(tab, watchIt, newTimer + ~~(100 * Math.random())) // eslint-disable-line @typescript-eslint/no-use-before-define
          job.start()
        }
      }
    } catch (err) {
      if (err.code === 404) {
        if (expectedFinalState === 'OfflineLike') {
          debug('resource not found after status check, but that is ok because that is what we wanted')
          job.abort()
        }
      } else {
        while (resultDom.firstChild) {
          resultDom.removeChild(resultDom.firstChild)
        }
        job.abort()
        throw err
      }
    }

    // diff the refreshed model from the existing one and apply the change
    const applyRefreshResult = (newRowModel: Row[], existingTable: ExistingTableSpec) => {
      const diff = diffTableRows(existingTable.rowsModel, newRowModel)
      if (diff.rowUpdate && diff.rowUpdate.length > 0) {
        debug('update rows', diff.rowUpdate)
        diff.rowUpdate.map(update => {
          udpateTheRow(update.model, update.updateIndex, existingTable)(tab, formatRowOption)
        })
      }

      if (diff.rowDeletion && diff.rowDeletion.length > 0) {
        debug('delete rows', diff.rowDeletion)
        diff.rowDeletion
          .filter(_ => _.model.name !== 'NAME')
          .map(rowDeletion => {
            deleteTheRow(rowDeletion.model, rowDeletion.deleteIndex, existingTable)
          })
      }

      if (diff.rowInsertion && diff.rowInsertion.length > 0) {
        debug('insert rows', diff.rowInsertion)
        diff.rowInsertion.map(insert => {
          insertTheRow(insert.model, insert.insertBeforeIndex, existingTable)(tab, formatRowOption)
        })
      }
    }

    applyRefreshResult(processedTableRow, existingTable)
  }

  // timer handler
  const watchIt = () => {
    if (--watchLimit < 0) {
      console.error('watchLimit exceeded')
      job.abort()
    } else {
      try {
        Promise.resolve(refreshTable())
      } catch (err) {
        console.error('Error refreshing table', err)
        job.abort()
      }
    }
  }

  // establish the inital watchable job
  job = new WatchableJob(tab, watchIt, ladder.shift() + ~~(100 * Math.random()))
  job.start()
}
