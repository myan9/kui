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

import * as React from 'react'
import { v4 as uuid } from 'uuid'

import {
  eventChannelUnsafe,
  isWatchable,
  ScalarResponse,
  Tab,
  Table,
  isTable,
  Watchable,
  ParsedOptions
} from '@kui-shell/core'
import renderTable from '../Content/Table'
import { cwd as _cwd } from './Sidecar/BaseSidecar'
import CircularBuffer from './Sidecar/CircularBuffer' // FIXME: hoist this up
import sameCommand from './Sidecar/same'

import '../../../web/css/static/WatchPane.scss'

interface Props {
  uuid?: string
  tab: Tab
  openWatchPane: () => void
}

interface HistoryEntry {
  uuid: string
  cwd: string
  argvNoOptions: string[]
  parsedOptions: ParsedOptions

  response: Table & Watchable
}

interface State {
  current: HistoryEntry
  history: CircularBuffer<HistoryEntry>
}

export default class WatchPane extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const channel = `/command/complete/fromuser/ScalarResponse/${this.props.uuid}`
    const onResponse = this.onResponse.bind(this)
    eventChannelUnsafe.on(channel, onResponse)

    this.state = {
      current: undefined,
      history: undefined
    }
  }

  private onResponse(tab: Tab, response: ScalarResponse, _, argvNoOptions: string[], parsedOptions: ParsedOptions) {
    if (isTable(response) && isWatchable(response)) {
      console.error('on response', response)
      this.setState(curState => {
        const cwd = _cwd()

        const existingIdx = curState.history
          ? curState.history.findIndex(sameCommand(argvNoOptions, parsedOptions, cwd))
          : -1

        const current: HistoryEntry = {
          uuid: uuid(),
          response,
          argvNoOptions,
          parsedOptions,
          cwd
        }

        if (current) {
          this.props.openWatchPane()

          if (!curState.history) {
            return {
              current,
              history: new CircularBuffer(current, this.capacity())
            }
          } else {
            if (existingIdx === -1) {
              curState.history.push(current)
            } else {
              curState.history.update(existingIdx, current)
            }

            return {
              current,
              history: curState.history
            }
          }
        }
      })
    }
  }

  private capacity() {
    return 3
  }

  public render() {
    return (
      <div className="kui--watch-pane kui--inverted-color-context">
        {this.state.history &&
          this.state.history.peekAll.map((history, key) => (
            <div className="kui--watch-subpane" data-pane-id={key} key={history.uuid}>
              {renderTable(this.props.tab, this.props.tab.REPL, history.response, undefined, true, true)}
            </div>
          ))}
      </div>
    )
  }
}
