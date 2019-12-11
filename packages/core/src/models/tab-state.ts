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

import { ResourceWatchJob } from '../core/job'
import { inBrowser } from '../core/capabilities'
import { getCurrentPrompt } from '../webapp/prompt'
import { theme, inBottomInputMode } from '../core/settings'

const debug = Debug('core/models/TabState')

/**
 * State that we want to keep per tab
 *
 */
export default class TabState {
  /** is the tab closed? */
  public closed: boolean

  /** environment variables */
  private _env: Record<string, string>

  /** current working directory */
  private _cwd: string

  /** jobs attached to this tab */
  private _jobs: ResourceWatchJob[]

  private _age: number[]

  private _ageCounter = 0

  private _currentBottomInputValue = ''

  /** is there a drilldown in progress for this tab? */
  public drilldownInProgress: Promise<void>

  public get env() {
    return this._env
  }

  public get cwd() {
    return this._cwd
  }

  public get currentBottomInputValue() {
    return this._currentBottomInputValue
  }

  public capture() {
    this._env = Object.assign({}, process.env)
    this._cwd = inBrowser() ? process.env.PWD : process.cwd().slice(0) // just in case, copy the string

    if (inBottomInputMode) {
      this._currentBottomInputValue = getCurrentPrompt().value
    }

    debug('captured tab state', this.cwd)
  }

  /**
   * @return the number of attached jobs
   */
  public get jobs(): number {
    return !this._jobs ? 0 : this._jobs.filter(_ => _ !== undefined).length
  }

  /** INTERNAL: abort the oldest job, and return the index of its slot */
  private abortOldestJob(): number {
    const oldestSlot = this._age.reduce((minAgeIdx, age, idx, ages) => {
      if (minAgeIdx === -1) {
        return idx
      } else if (ages[minAgeIdx] > age) {
        return idx
      } else {
        return minAgeIdx
      }
    }, -1)

    this._jobs[oldestSlot].abort()
    return oldestSlot
  }

  /** INTERNAL: find a free job slot, aborting the oldest job if necessary to free up a slot */
  private findFreeJobSlot(): number {
    const idx = this._jobs.findIndex(_ => _ === undefined)
    if (idx === -1) {
      return this.abortOldestJob()
    } else {
      return idx
    }
  }

  /** attach a job to this tab */
  public captureJob(job: ResourceWatchJob) {
    if (!this._jobs) {
      const maxJobs = theme.maxWatchersPerTab || 6
      this._jobs = new Array<ResourceWatchJob>(maxJobs)
      this._age = new Array<number>(maxJobs)
    }
    const slot = this.findFreeJobSlot()
    this._jobs[slot] = job
    this._age[slot] = this._ageCounter++
  }

  /**
   * Abort all jobs attached to this tab
   *
   */
  public abortAllJobs() {
    if (this._jobs) {
      this._jobs.forEach((job, idx) => {
        this.abortAt(idx)
      })
    }
  }

  /** INTERNAL: abort the job at the given index */
  private abortAt(idx: number) {
    this._jobs[idx].abort()
    this.clearAt(idx)
  }

  /** INTERNAL: clear the references to the job at the given index */
  private clearAt(idx: number) {
    this._jobs[idx] = undefined
    this._age[idx] = undefined
  }

  /**
   * Clear any references to the given job. It is assumed that the
   * caller is responsible for aborting the job.
   *
   */
  public removeJob(job: ResourceWatchJob) {
    if (this._jobs) {
      const idx = this._jobs.findIndex(existingJob => existingJob && existingJob.getId() === job.getId())
      this.clearAt(idx)
    }
  }

  public restore() {
    process.env = this._env

    if (inBrowser()) {
      debug('changing cwd', process.env.PWD, this._cwd)
      process.env.PWD = this._cwd
    } else {
      debug('changing cwd', process.cwd(), this._cwd)
      process.chdir(this._cwd)
    }

    if (inBottomInputMode) {
      getCurrentPrompt().value = this.currentBottomInputValue
    }
  }
}
