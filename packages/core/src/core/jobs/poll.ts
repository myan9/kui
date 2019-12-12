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
import { WatchedRowHasUpdate, WactchedRowisOffline } from '../../core/jobs/watchable'
import { Entity } from '../../models/entity'
import { _split as split, Split } from '../../repl/split'
import { Tab } from '../../webapp/tab'
import { prepareTable } from '../../webapp/views/table'
import { Row, isTable, sortBody } from '../../webapp/models/table'

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
const hasReachedFinalState = (rows: Row[]) => rows.length !== 0 && rows.every(row => row.done)

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
export const registerWatcher = (watchLimit = 100000, command: string, resultDom: HTMLElement, oldRows: Row[]) => (
  tab: Tab,
  updated: WatchedRowHasUpdate,
  deleted: WactchedRowisOffline
) => {
  if (hasReachedFinalState(oldRows)) return
  let job: WatchableJob // eslint-disable-line prefer-const

  // the final state we want to reach to
  const expectedFinalState = findFinalStateFromCommand(command)

  // establish the initial watch interval,
  // if we're on resource creation/deletion, do fast polling, otherwise we do steady polling
  const initalPollingInterval =
    expectedFinalState === 'OfflineLike' || expectedFinalState === 'OnlineLike' ? fastPolling : mediumPolling

  // increase the table polling interval until it reaches the steady polling interval, store the ladder in an array
  const ladder = calculateLadder(initalPollingInterval)

  // execute the refresh command and apply the result
  const refreshTable = async () => {
    debug(`refresh with ${command}`)

    try {
      const { qexec } = await import('../../repl/exec')
      const response = await qexec<Entity>(command)

      if (isTable(response)) {
        /* diff and apply the changes between new and old tables */
        const rows = prepareTable(tab, response)
        const deletes = oldRows
        const inserts: Row[] = []

        rows.forEach(row => {
          const idx = oldRows.findIndex(_ => _.name === row.name)
          if (idx !== -1) {
            deletes.splice(idx, 1)
            if (JSON.stringify(row) !== JSON.stringify(oldRows[idx])) {
              updated(row)
            }
          } else {
            response.noSort ? updated(row) : inserts.push(row)
          }
        })

        deletes.forEach(_ => deleted(_.name))

        if (!response.noSort) {
          // To get a correct index of insertion, first concat with the existing rows, then sort
          sortBody(oldRows.concat(inserts)).forEach(updated)
        }

        if (hasReachedFinalState(response.body)) {
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
      } else {
        throw new Error('Refresh result is not a table')
      }
    } catch (err) {
      if (err.code === 404) {
        // stop polling if the final state is reached, otherwise, keep polling
        if (expectedFinalState === 'OfflineLike') {
          job.abort()
          // delete the table body
          oldRows.filter(_ => _.name !== 'NAME').forEach(_ => deleted(_.name))
        }
      } else {
        // Otherwise, clear the table view and tell job manager to stop watching
        while (resultDom.firstChild) {
          resultDom.removeChild(resultDom.firstChild)
        }
        job.abort()
        throw err
      }
    }
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
