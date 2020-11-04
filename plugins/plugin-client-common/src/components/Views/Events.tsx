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

import React from 'react'
import prettyPrintDuration from 'pretty-ms'

import {
  Tab,
  Abortable,
  FlowControllable,
  Streamable,
  i18n
} from '@kui-shell/core'
import Markdown from '../Content/Markdown'

interface Pair {
  key: string
  value: string
}

const strings = i18n('plugin-client-common')

/**
 * Find the column splits
 *
 */
function preprocessTable(raw: string, nCols): { rows: Pair[][]; leftover: string } {
  const rows = raw.split(/\n/).map(line => {
    const cells = line.split(/\|/)
    return cells.slice(0, cells.length - 1) // we have a trailing |
  })

  let lastFullRowIdx = rows.length
  while (--lastFullRowIdx >= 0) {
    if (rows[lastFullRowIdx].length === nCols) {
      break
    }
  }

  if (lastFullRowIdx < 0) {
    return {
      leftover: raw,
      rows: []
    }
  } else if (lastFullRowIdx === rows.length - 1) {
    return {
      leftover: undefined,
      rows: rows.map(line => line.map(value => ({ key: value, value }))).filter(_ => _.length > 0)
    }
  } else {
    let lastNewlineIdx = raw.length
    while (--lastNewlineIdx >= 0) {
      if (raw.charAt(lastNewlineIdx) === '\n') {
        break
      }
    }

    const leftover = raw.slice(lastNewlineIdx)
    return {
      leftover,
      rows: rows
        .slice(0, lastFullRowIdx + 1)
        .map(line => line.map(value => ({ key: value, value })))
        .filter(_ => _.length > 0)
    }
  }
}

function notEmpty<TValue>(value: TValue | void | null | undefined): value is TValue {
  return value !== null && value !== undefined
}


interface Props {
  command: string
  tab: Tab
  involvedNames: string[]
  involvedKinds: string[]
}

type Job = Abortable & FlowControllable

interface State {
  streams?: {
    involvedName: string,
    involvedKind: string,
    message: string, 
  }[]
  job?: Job /** The underlying PTY streaming job */
  involvedNames: string[]
  involvedKinds: string[]
}

export default class Events extends React.PureComponent<Props, State> {
  private eventLeftover: string
  /** Timestamp when we started up */
  private now = Date.now()

  public constructor(props) {
    super(props)
    
    this.initStream()

    this.state = {
      involvedNames: props.involvedNames,
      involvedKinds: props.involvedKinds
    }
  }

  public static getDerivedStateFromProps(props: Props) {
    return {
      involvedNames: props.involvedNames,
      involvedKinds: props.involvedKinds
    }
  }

  private onPTYInitDone(job: Job) {
    this.setState({ job })
  }

  private onPTYEventInit() {
    return async (_: Streamable) => {
      if (typeof _ === 'string') {
        const rawData = this.eventLeftover ? this.eventLeftover + _ : _
        this.eventLeftover = undefined
        // here is where we turn the raw data into tabular data
        const preprocessed = preprocessTable(rawData, 5) //FIXME: the preprocess table with columns should come with event args
        this.eventLeftover = preprocessed.leftover === '\n' ? undefined : preprocessed.leftover
        
        // filter and format the row as `[ago] involvedObject.name: message`
        const sortedRows = preprocessed.rows
          .filter(notEmpty)
          .sort((rowA, rowB) => {
            const lastSeenA = new Date(rowA[0].value).getTime()
            const lastSeenB = new Date(rowB[0].value).getTime()
            return lastSeenA - lastSeenB
          })

        const agos = sortedRows.map(row => {
          const ts = new Date(row[0].value).getTime()
          const ago = this.now - ts

          if (isNaN(ago)) {
            // kubectl displays "<unknown>"
            return strings('<unknown>')
          } else if (ago <= 0) {
            // < 0 is probably due to clock skew
            return strings('ago', prettyPrintDuration(0))
          } else {
            return strings('ago', prettyPrintDuration(ago >= 0 ? ago : 0, { compact: true }).toString())
          }
        })

        const rows = sortedRows.map((row, idx) => {
          const involvedObjectName = row[1].value
          const message = row[2].value
          // TODO: const apiVersion = row[3].value
          const kind = row[4].value
         
          return {
            involvedName: involvedObjectName,
            involvedKind: kind,
            message: `[[${agos[idx]}]](#kuiexec?command=foo)` + ` **${involvedObjectName}**: ${message}`
          }
        })

        if (rows) {
          // concat with all streams
          this.setState(curState => {
            return {
              streams: curState.streams ? curState.streams.concat(rows) : rows
            }
          })
        }
      }
    }
  }

  private onPTYEventExit(exitCode: number) {
    console.error('event stream exited with code', exitCode)
  }

  /** Initialize the event stream */
  private initStream() {
    console.error('initStream', this.props.command)
    this.props.tab.REPL.qexec(
      `sendtopty ${this.props.command}`,
      undefined,
      undefined,
      {
        quiet: true,
        replSilence: true,
        echo: false,
        onReady: this.onPTYInitDone.bind(this),
        onInit: this.onPTYEventInit.bind(this), // <-- the PTY will call us back when it's ready to stream
        onExit: this.onPTYEventExit.bind(this)
      }
    )
  }

  // FIXME: this is sometimes incorrect, e.g. when the class got re-constructed (needs triage)
  public componentWillUnmount() {
    if (this.state.job) {
      console.error('abort', this.state)
      this.state.job.abort()
    }
  }

  private messageStream() {
    // TODO: add streams back to treeview response for snapshot and replay
    if (this.state.streams) {
      const _streams =  this.state.streams
        .filter(({ involvedName }) => !this.state.involvedNames || this.state.involvedNames.includes(involvedName))
        .filter(({ involvedKind }) => !this.state.involvedKinds || this.state.involvedKinds.includes(involvedKind))
      
      if (_streams.length === 0) {
        return this.nothingToShow()
      } else {
        return _streams.map(({ message }, idx) => (
          <div key={`${message}-${idx}`} className="kui--treeview-events-messages">
            <div className="kui--treeview-events-message">
              <Markdown className="marked-content page-content" source={message} noExternalLinks repl={this.props.tab.REPL} />
            </div>
          </div>
        ))
      }
    }
  }

  /** Render the events in the case we no logs to show. */
  private nothingToShow() {
    return <div className="kui--treeview-events-messages">{strings('No events')}</div>
  }

  public render() {
    return (
      <div className="kui--treeview-events">
        {!this.state.streams
          ? this.nothingToShow()
          : this.messageStream()}
      </div>
    )
  }
}
