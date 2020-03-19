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
import { Close16 } from '@carbon/icons-react'
import { i18n, eventChannelUnsafe, Event, ExecType, Theme } from '@kui-shell/core'
import { HeaderMenuItem } from 'carbon-components-react'

const strings = i18n('plugin-core-support')

export interface TabConfiguration {
  topTabNames?: 'command' | 'fixed' // was { topTabs } from '@kui-shell/client/config.d/style.json'
  productName?: string
}

type Props = TabConfiguration & {
  idx: number
  uuid: string
  active: boolean
  closeable: boolean
  onCloseTab: (idx: number) => void
  onSwitchTab: (idx: number) => void
}

interface State {
  title: string
  processing: boolean
  isFreshlyCreated: boolean
  topTabNames: 'command' | 'fixed'
}

export default class Tab extends React.PureComponent<Props, State> {
  private onCommandStart: (evt: Event) => void
  private onCommandComplete: (evt: Event) => void
  private onThemeChange: ({ themeModel: Theme }) => void

  public constructor(props: Props) {
    super(props)

    this.state = {
      title: strings('Tab'),
      processing: false,
      isFreshlyCreated: true,
      topTabNames: props.topTabNames || 'command'
    }

    this.addCommandEvaluationListeners()
  }

  public componentWillUnmount() {
    this.removeCommandEvaluationListeners()
  }

  private removeCommandEvaluationListeners() {
    eventChannelUnsafe.off('/command/start', this.onCommandStart)
    eventChannelUnsafe.off('/command/complete', this.onCommandComplete)
    eventChannelUnsafe.off('/theme/change', this.onThemeChange)
  }

  /**
   * Register any command evaluation listeners, i.e. when the REPL finishes evaluating a command.
   *
   */
  private addCommandEvaluationListeners() {
    this.onCommandComplete = (event: Event) => {
      if (this.props.uuid === event.tab.state.uuid) {
        if (event.execType !== undefined && event.execType !== ExecType.Nested && event.route) {
          // ignore nested, which means one plugin calling another
          this.setState({ processing: false })
        }

        this.setState({ processing: false })
      }
    }

    this.onCommandStart = (event: Event) => {
      if (this.props.uuid === event.tab.state.uuid) {
        if (event.execType !== undefined && event.execType !== ExecType.Nested && event.route) {
          // ignore nested, which means one plugin calling another
          // debug('got event', event)
          if (
            event.route !== undefined &&
            !event.route.match(/^\/(tab|getting\/started)/) // ignore our own events and help
          ) {
            if (this.isUsingCommandName()) {
              this.setState({ processing: true, title: event.command || this.state.title, isFreshlyCreated: false })
              return
            }
          }

          this.setState({ processing: true, isFreshlyCreated: false })
        }
      }
    }

    this.onThemeChange = ({ themeModel }: { themeModel: Theme }) => {
      this.setState({
        topTabNames: themeModel.topTabNames || 'command'
      })
    }

    eventChannelUnsafe.on('/command/start', this.onCommandStart)
    eventChannelUnsafe.on('/command/complete', this.onCommandComplete)
    eventChannelUnsafe.on('/theme/change', this.onThemeChange)
  }

  private isUsingCommandName() {
    return this.state.topTabNames === 'command' // && !document.body.classList.contains('kui--alternate')
  }

  public render() {
    return (
      <HeaderMenuItem
        href="#"
        data-tab-names={this.state.topTabNames}
        data-fresh={this.state.isFreshlyCreated}
        className={
          'kui--tab kui--tab-navigatable' +
          (this.props.active ? ' kui--tab--active' : '') +
          (this.state.processing ? ' processing' : '')
        }
        data-tab-button-index={this.props.idx + 1}
        aria-label="tab"
        onMouseDown={evt => {
          evt.preventDefault()
          evt.stopPropagation()
        }}
        onClick={() => {
          this.props.onSwitchTab(this.props.idx)
        }}
      >
        <div className="kui--tab--label">
          {this.isUsingCommandName() && this.state.title}
          {!this.isUsingCommandName() && <span className="kui--tab--label-text">{strings('Tab')} </span>}
          {!this.isUsingCommandName() && <span className="kui--tab--label-index"></span>}
        </div>

        {this.props.closeable && (
          <div
            className="kui--tab-close"
            onClick={evt => {
              evt.stopPropagation()
              evt.preventDefault()
              this.props.onCloseTab(this.props.idx)
            }}
          >
            <Close16 focusable="false" preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
          </div>
        )}
      </HeaderMenuItem>
    )
  }
}
