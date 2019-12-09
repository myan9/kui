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

import { Tab } from '../webapp/cli'
import { theme } from './settings'
import { hasReachedFinalState, findFinalStateFromCommand } from '../webapp/views/table'
import { CodedError } from '../models/errors'
import { MetadataBearing as ResourceWithMetadata } from '../models/entity'

const debug = Debug('webapp/views/jobs')

const fastPolling = 500 // initial polling rate for watching OnlineLike or OfflineLike state
const mediumPolling = 3000 // initial polling rate for watching a steady state
const finalPolling = (theme && theme.tablePollingInterval) || 5000 // final polling rate (do not increase the interval beyond this!)
debug('polling intervals', fastPolling, mediumPolling, finalPolling)

type ResourceChangeFn = (resource: ResourceWithMetadata) => void

export type ResourceWatcher = {
  getId: () => number
  init: (tab: Tab, updated: ResourceChangeFn, deleted: (err: CodedError) => void) => void
  abort(): void
}

/**
 * help calcuate the ladder polling interval
 *
 */
function createLadderInterval(expectedFinalState: string) {
  // establish the initial watch interval,
  // if we're on resource creation/deletion, do fast polling, otherwise we do steady polling
  const initalPollingInterval =
    expectedFinalState === 'OfflineLike' || expectedFinalState === 'OnlineLike' ? fastPolling : mediumPolling

  // increase the table polling interval until it reaches the steady polling interval, store the ladder in an array
  const ladder = [initalPollingInterval]
  let current = initalPollingInterval

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

export class PollWatcher implements ResourceWatcher {
  private pollCommand: string
  private pollLimit: number
  private pollInterval: number[]

  private _id: number
  private tab: Tab

  private updated: ResourceChangeFn
  private deleted: (err: CodedError) => void

  public getId() {
    return this._id
  }

  public constructor(pollCommand: string, pollLimit?: number, pollInterval?: number[]) {
    this.pollCommand = pollCommand
    this.pollLimit = pollLimit || 100000
    this.pollInterval = pollInterval || createLadderInterval(findFinalStateFromCommand(pollCommand))
  }

  public init(tab: Tab, updated: ResourceChangeFn, deleted: (err: CodedError) => void) {
    this.tab = tab
    this.updated = updated
    this.deleted = deleted
    this._id = setInterval(this.watchIt.bind(this) as TimerHandler, this.pollInterval.shift() + ~~(100 * Math.random()))
    this.tab.state.captureJob(this)
  }

  public abort() {
    clearInterval(this._id)
    this.tab.state.removeJob(this)
    debug(`stop job ${this._id}`)
  }

  private reschedule() {
    if (this.pollInterval.length > 0) {
      this.abort()
      new PollWatcher(this.pollCommand, this.pollLimit, this.pollInterval).init(this.tab, this.updated, this.deleted)
    }
  }

  private async poll() {
    debug(`refresh with ${this.pollCommand}`)

    try {
      const { qexec } = await import('../repl/exec')
      const response = await qexec<ResourceWithMetadata>(this.pollCommand)
      this.updated(response)
      hasReachedFinalState(response) ? this.abort() : this.reschedule()
    } catch (err) {
      this.deleted(err)
      throw err
    }
  }

  private watchIt() {
    if (--this.pollLimit < 0) {
      console.error('watchLimit exceeded')
      this.abort()
    } else {
      Promise.resolve(this.poll()).catch(() => this.abort())
    }
  }
}
