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
import { KResponse, ParsedOptions, eventChannelUnsafe, isPopup } from '@kui-shell/core'

import Width from './width'
import { Props as BaseProps } from './BaseSidecar'
import TitleBar, { Props as TitleBarProps } from './TitleBar'

export type Props<R extends KResponse> = BaseProps & {
  response?: R
  argvNoOptions?: string[]
  parsedOptions?: ParsedOptions
  onRender?: (hasContent: boolean) => void
}

export interface State {
  /** screenshotable region */
  dom?: HTMLElement

  /** maximized? */
  isMaximized?: boolean
}

export default class BaseSidecar<R extends KResponse, S extends State> extends React.PureComponent<Props<R>, S> {
  protected get current() {
    return this.state
  }

  protected defaultWidth(): Width {
    return this.props.defaultWidth || Width.Split60
  }

  /** Escape key toggles sidecar visibility */
  private onEscape(evt: KeyboardEvent) {
    if (
      evt.key === 'Escape' &&
      this.props.active &&
      !document.getElementById('confirm-dialog') &&
      !isPopup() &&
      this.current
    ) {
      if (this.props.willChangeSize) {
        this.props.willChangeSize(this.props.width === Width.Closed ? this.defaultWidth() : Width.Closed)
      }
    }
  }

  protected onMaximize() {
    if (this.props.willChangeSize) {
      this.props.willChangeSize(Width.Maximized)
    }
    this.setState({ isMaximized: true })
  }

  protected onRestore() {
    if (this.props.willChangeSize) {
      this.props.willChangeSize(this.defaultWidth())
    }
    this.setState({ isMaximized: false })
  }

  protected onClose() {
    if (this.props.onClose) {
      this.props.onClose()
    }

    if (this.props.willChangeSize) {
      this.props.willChangeSize(Width.Closed)
    }
  }

  protected isFixedWidth() {
    return false
  }

  protected width(): Required<string> {
    return 'visible' + (this.state.isMaximized ? ' maximized' : '')
  }

  private onScreenshot() {
    if (this.props.willLoseFocus) {
      this.props.willLoseFocus()
    }

    // async, to allow willLoseFocus() to take affect
    setTimeout(() => {
      eventChannelUnsafe.emit('/screenshot/element', this.state.dom)
    })
  }

  protected title(
    props?: Omit<
      TitleBarProps,
      'width' | 'fixedWidth' | 'onClose' | 'onRestore' | 'onMaximize' | 'onMinimize' | 'willScreenshot' | 'repl'
    >
  ) {
    return (
      <TitleBar
        {...props}
        notCloseable
        repl={this.props.tab.REPL}
        width={this.state.isMaximized ? Width.Maximized : this.defaultWidth()}
        fixedWidth={this.isFixedWidth()}
        onMaximize={this.onMaximize.bind(this)}
        onRestore={this.onRestore.bind(this)}
        onClose={this.onClose.bind(this)}
        willScreenshot={this.onScreenshot.bind(this)}
      />
    )
  }
}
