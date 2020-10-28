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
import {
  isMessageWithUsageModel,
  isMessageWithCode,
  CommandCompleteEvent,
  KResponse,
  getPrimaryTabId,
  i18n,
  isCommentaryResponse,
  isHTML,
  isMarkdownResponse,
  isMultiModalResponse,
  isNavResponse,
  isReactResponse,
  isRadioTable,
  isRandomErrorResponse1,
  isRandomErrorResponse2,
  isTable,
  isMixedResponse,
  isXtermResponse,
  isUsageError
} from '@kui-shell/core'

import Commentary from '../Commentary'
import HTMLDom from './HTMLDom'
import XtermDom from './XtermDom'
import renderTable from '../Table'
import Markdown from '../Markdown'
import { KuiContext } from '../../../'
import RadioTableSpi from '../../spi/RadioTable'
import Accordion from '../../spi/Accordion'
import { Maximizable } from '../../Views/Sidecar/width'
import LocationProps from '../../Views/Sidecar/Location'
import { BlockViewTraits } from '../../Views/Terminal/Block'
import { isError } from '../../Views/Terminal/Block/BlockModel'
import TopNavSidecar from '../../Views/Sidecar/TopNavSidecarV2'
import LeftNavSidecar from '../../Views/Sidecar/LeftNavSidecarV2'

const strings = i18n('plugin-client-common', 'errors')

type Props = Maximizable &
  BlockViewTraits &
  LocationProps & {
    response: KResponse | Error
    completeEvent?: CommandCompleteEvent
    onRender?: (hasContent: boolean) => void
    willRemove?: () => void
    willUpdateCommand?: (command: string) => void
  }

interface State {
  catastrophicError: Error
}

/**
 * Component that renders a "ScalarResponse", which is a command
 * response that doesn't require any particularly special
 * interpretation or visualization of the inner structure --- i.e. a
 * response that is suitable for rendering directly in the Terminal.
 *
 */
export default class Scalar extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = Scalar.getDerivedStateFromProps()
  }

  public static getDerivedStateFromProps() {
    return {
      catastrophicError: undefined
    }
  }

  public static getDerivedStateFromError(error) {
    return { catastrophicError: error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('catastrophic error in Scalar', error, errorInfo)
  }

  public render() {
    if (this.state.catastrophicError) {
      return <div className="oops">{this.state.catastrophicError.toString()}</div>
    }

    const { tab, response } = this.props

    try {
      if (typeof response === 'boolean') {
        return <React.Fragment />
      } else if (typeof response === 'number') {
        return <pre>{response}</pre>
      } else if (isUsageError(response)) {
        // hopefully we can do away with this shortly
        if (typeof response.raw === 'string') {
          return <pre>{response.raw}</pre>
        } else if (isMessageWithUsageModel(response.raw) || isMessageWithCode(response.raw)) {
          return <pre>{response.raw.message}</pre>
        } else {
          return <HTMLDom content={response.raw} />
        }
      } else if (isXtermResponse(response)) {
        return <XtermDom response={response} />
      } else if (typeof response === 'string' || isError(response)) {
        const message = isError(response) ? response.message : response

        // Markdown interprets escapes, so we need to double-escape
        return (
          <pre>
            <Markdown tab={tab} repl={tab.REPL} source={message.replace(/\\/g, '\\\\').replace(/\n/g, '\n\n')} />
          </pre>
        )
      } else if (isCommentaryResponse(response)) {
        return (
          <span className="flex-fill flex-layout flex-align-stretch">
            <Commentary
              {...response.props}
              repl={tab.REPL}
              tabUUID={getPrimaryTabId(tab)}
              isPartOfMiniSplit={this.props.isPartOfMiniSplit}
              willRemove={this.props.willRemove}
              willUpdateCommand={this.props.willUpdateCommand}
              willUpdateResponse={(text: string) => {
                response.props.children = text
              }}
            />
          </span>
        )
      } else if (isRadioTable(response)) {
        return (
          <KuiContext.Consumer>
            {config => <RadioTableSpi table={response} title={!config.disableTableTitle} repl={tab.REPL} />}
          </KuiContext.Consumer>
        )
      } else if (isTable(response)) {
        const renderBottomToolbar = true
        const isLargeTable = response.body.length >= 50
        const isLargeMiniTable = this.props.isPartOfMiniSplit && response.body.length > 5
        const renderGrid =
          (isLargeTable || isLargeMiniTable) &&
          (response.allowedPresentations === undefined || response.allowedPresentations.indexOf('grid') >= 0)
        
          const table = renderTable(
          tab,
          tab.REPL,
          response,
          undefined,
          renderBottomToolbar,
          renderGrid,
          this.props.onRender,
          this.props.isPartOfMiniSplit,
          this.props.isWidthConstrained
        )
        // ^^^ Notes: typescript doesn't like this, and i don't know why:
        // "is not assignable to type IntrinsicAttributes..."
        // <PaginatedTable {...props} />

        return (
          <Accordion
            items={[{ label: 'Resource as Applied', name: 'Resource as Applied', expandedByDefault: true, content: table }]}
            isWidthConstrained={this.props.isWidthConstrained}
            tab={this.props.tab}
          />
        )
      } else if (isMixedResponse(response)) {
        return (
          <React.Fragment>
            {response.map((part, idx) => (
              <Scalar {...this.props} key={idx} response={part} />
            ))}
          </React.Fragment>
        )
      } else if (isReactResponse(response)) {
        return response.react
      } else if (isHTML(response)) {
        // ^^^ intentionally using an "else" so that typescript double
        // checks that we've covered every case of ScalarResponse
        return <HTMLDom content={response} />
      } else if (isMarkdownResponse(response)) {
        return <Markdown tab={tab} repl={tab.REPL} source={response.content} />
      } else if (isRandomErrorResponse1(response)) {
        // maybe this is an error response from some random API?
        return <Markdown tab={tab} repl={tab.REPL} source={strings('randomError1', response.code)} />
      } else if (isRandomErrorResponse2(response)) {
        // maybe this is an error response from some random API?
        return <Markdown tab={tab} repl={tab.REPL} source={strings('randomError2', response.errno)} />
      } else if (isMultiModalResponse(response)) {
        return (
          <TopNavSidecar
            uuid={tab.uuid}
            tab={tab}
            execUUID={this.props.execUUID}
            active
            response={response}
            onRender={this.props.onRender}
            willChangeSize={this.props.willChangeSize}
            argvNoOptions={this.props.completeEvent ? this.props.completeEvent.argvNoOptions : undefined}
            parsedOptions={this.props.completeEvent ? this.props.completeEvent.parsedOptions : undefined}
          />
        )
      } else if (isNavResponse(response)) {
        return (
          <LeftNavSidecar
            uuid={tab.uuid}
            tab={tab}
            execUUID={this.props.execUUID}
            active
            response={response}
            onRender={this.props.onRender}
            willChangeSize={this.props.willChangeSize}
            argvNoOptions={this.props.completeEvent ? this.props.completeEvent.argvNoOptions : undefined}
            parsedOptions={this.props.completeEvent ? this.props.completeEvent.parsedOptions : undefined}
          />
        )
      }
    } catch (err) {
      console.error('catastrophic error rendering Scalar', err)
      return <pre>{err.toString()}</pre>
    }

    console.error('unexpected null return from Scalar:', response)
    return <pre className="oops">Internal Error in command execution</pre>
  }
}
