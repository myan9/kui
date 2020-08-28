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

// FIXME:
/* eslint-disable react/prop-types */

import * as React from 'react'
import { eventBus, pexecInCurrentTab, i18n, StatusStripeChangeEvent } from '@kui-shell/core'

import Icons from '../../spi/Icons'
import Markdown from '../../Content/Markdown'
import '../../../../web/scss/components/StatusStripe/StatusStripe.scss'

const strings = i18n('plugin-client-common')

type State = StatusStripeChangeEvent
export type Props = Partial<State>

export default class StatusStripe extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    eventBus.onStatusStripeChangeRequest(this.onChangeRequest.bind(this))

    this.state = Object.assign({ type: 'default' }, props)
  }

  /** Status Stripe change request */
  private onChangeRequest(evt: StatusStripeChangeEvent) {
    this.setState(evt)
  }

  /**
   * User has clicked on the Settings icon.
   *
   */
  private async doAbout() {
    pexecInCurrentTab('about')
  }

  /**
   * If the Client offers no status stripe widgets, we should insert a
   * filler, so that the Settings icon is presented flush-right.
   *
   */
  private filler() {
    return <div style={{ flex: 1 }} />
  }

  /**
   * Render the current State.message, if any
   *
   */
  private message() {
    if (this.state.type !== 'default' && this.state.message) {
      return (
        <div className="kui--status-stripe-element left-pad">
          <Markdown source={this.state.message} />
        </div>
      )
    }
  }

  /**
   * Render any widgets specified by the client. Note how we don't
   * show widgets if we were given a message. See
   * https://github.com/IBM/kui/issues/5490
   *
   */
  private widgets() {
    if (this.state.type !== 'default' || React.Children.count(this.props.children) === 0) {
      return this.filler()
    } else {
      return this.props.children
    }
  }

  private className() {
    return 'kui--status-stripe' + (this.state.type === 'default' ? ' kui--inverted-color-context' : '')
  }

  public render() {
    return (
      <div className={this.className()} id="kui--status-stripe" data-type={this.state.type}>
        {this.message()}
        {this.widgets()}

        <div className="kui--status-stripe-button">
          <a
            href="#"
            className="kui--tab-navigatable kui--status-stripe-element-clickable kui--status-stripe-element"
            id="help-button"
            aria-label="Help"
            tabIndex={0}
            title={strings('Click to view configuration options')}
            onClick={() => this.doAbout()}
          >
            <Icons icon="Settings" />
          </a>
        </div>
      </div>
    )
  }
}
