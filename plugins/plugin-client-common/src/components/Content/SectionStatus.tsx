/*
 * Copyright 2021 The Kubernetes Authors
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

import Icon from '../spi/Icons'

import { eventBus, eventChannelUnsafe } from '@kui-shell/core'

interface Props {
  className?: string
  type: 'section' | 'task'
  name: string
}

interface State {
  total: number
  ok: number
  error: number
}

export default class SectionStatus extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      total: 0,
      ok: 0,
      error: 0
    }
  }

  private async reportStatus(status: number[]) {
    this.setState({
      total: status[3],
      ok: status[0],
      error: status[1]
    })
  }

  /**
   * Once we have mounted, we immediately check the current branch,
   * and schedule an update based on standard REPL events.
   *
   */
  public componentDidMount() {
    eventChannelUnsafe.on(`/${this.props.type}/status/update/${this.props.name}`, this.reportStatus.bind(this))
    eventChannelUnsafe.emit(`/${this.props.type}/status/get`, this.props.name)
  }

  /** Bye! */
  public componentWillUnmount() {
    eventBus.off(`/${this.props.type}/status/update/${this.props.name}`, this.reportStatus)
  }

  private icon(ok: number, error: number, total: number) {
    const icon =
      this.props.type === 'task'
        ? ok !== 0
          ? 'Checkmark'
          : error !== 0
          ? 'Error'
          : 'Waiting'
        : ok !== total
        ? 'Waiting'
        : 'Checkmark'

    return <Icon className="section-status" icon={icon} />
  }

  private description(ok: number, error: number, total: number) {
    if (this.props.type === 'section') {
      return (
        <span className="even-smaller-text section-status">
          {ok}/{total} tasks ok
        </span>
      )
    } else {
      return <React.Fragment />
    }
  }

  public render() {
    const { ok, error, total } = this.state
    return (
      total !== 0 && (
        <React.Fragment>
          {this.icon(ok, error, total)}
          {this.description(ok, error, total)}
        </React.Fragment>
      )
    )
  }
}
