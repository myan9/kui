/*
 * Copyright 2020 IBM Corporation
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

import { v4 as uuid } from 'uuid'
import { ParsedOptions } from '@kui-shell/core'

export interface BaseHistoryEntry {
  cwd: string
  argvNoOptions: string[]
  parsedOptions: ParsedOptions
}

type InternalEntry<T extends BaseHistoryEntry> = T & {
  key: string
}

export default class CircularBuffer<T extends BaseHistoryEntry> {
  private readonly entries: InternalEntry<T>[]
  private activeIdx: number
  private insertionIdx: number
  private _length: number

  public constructor(first: T, capacity = 15) {
    this.entries = new Array<InternalEntry<T>>(capacity)
    this.activeIdx = 0
    this.insertionIdx = 1 % capacity
    this._length = 1
    this.entries[0] = this.entry(first)
  }

  private entry(asGiven: T): InternalEntry<T> {
    return Object.assign(asGiven, { key: uuid() })
  }

  public get length() {
    return this._length
  }

  public get key() {
    return this.peek().key
  }

  public findIndex(predicate: (t: T, idx?: number, A?: T[]) => boolean) {
    return this.entries.findIndex(predicate)
  }

  public update(idx: number, t: T) {
    this.entries[idx] = this.entry(t)
    this.activeIdx = idx
  }

  /** update at this.activeIdx */
  public updateActive(t: T) {
    this.update(this.activeIdx, t)
  }

  public push(entry: T) {
    const idx = this.insertionIdx
    this.entries[idx] = this.entry(entry)
    this.activeIdx = idx
    this.insertionIdx = (idx + 1) % this.entries.length
    this._length = Math.min(this._length + 1, this.entries.length)
  }

  /** pop the entry at idx */
  public popAt(idx: number) {
    while (idx < this._length - 1) {
      this.entries[idx] = this.entry(this.entries[++idx])
    }

    delete this.entries[idx]
    this.activeIdx = idx - 1
    this.insertionIdx = idx % this.entries.length
    this._length = this._length - 1
  }

  public hasLeft() {
    return this.activeIdx > 0
  }

  public shiftLeft() {
    let idx = this.activeIdx
    do {
      // note: javascript doesn't do the expected thing for negative numbers modulo N
      // ref: https://stackoverflow.com/a/4467559
      const N = this.entries.length
      idx = (((idx - 1) % N) + N) % N
    } while (!this.entries[idx])

    this.activeIdx = idx
    return this.peek()
  }

  /* public hasRight() {
    return this.activeIdx <
  } */

  public shiftRight() {
    let idx = this.activeIdx
    do {
      idx = (idx + 1) % this.entries.length
    } while (!this.entries[idx])

    this.activeIdx = idx
    return this.peek()
  }

  public peek() {
    return this.peekAt(this.activeIdx)
  }

  public peekAt(idx: number) {
    return this.entries[idx]
  }
}
