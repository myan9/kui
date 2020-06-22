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
import { dirname, join, relative } from 'path'
import MarkdownToJSX from 'markdown-to-jsx'
import { REPL, Tab as KuiTab } from '@kui-shell/core'
import {
  Link,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
  OrderedList,
  UnorderedList,
  ListItem
} from 'carbon-components-react'

import CodeSnippet from '../spi/CodeSnippet'

import 'carbon-components/scss/components/link/_link.scss'
import '../../../web/scss/components/List/Carbon.scss'
import '../../../web/scss/components/StructuredList/Carbon.scss'

interface Props {
  source: string

  tab?: KuiTab
  repl?: REPL

  /** if we have the full path to the source file */
  fullpath?: string

  /** css class for top-level element */
  className?: string
}

export default class Markdown extends React.PureComponent<Props> {
  private readonly _uuid = uuid()

  private onCopy(value: string) {
    navigator.clipboard.writeText(value)
  }

  private anchorFrom(txt: string): string {
    return `${this._uuid}-${txt}`
  }

  public render() {
    const list = props => {
      return React.createElement(
        props.ordered ? OrderedList : UnorderedList,
        { nested: props.depth > 0, className: props.className },
        props.children
      )
    }

    const tableCell = props => (
      <StructuredListCell head={props.isHeader} className={props.className}>
        {props.children}
      </StructuredListCell>
    )

    const heading = (props, level: number) => {
      console.error('props', props)
      const valueChild =
        props.children && props.children.length === 1 ? props.children[0] : props.children.find(_ => _.props.value)
      const anchor =
        !valueChild || !valueChild.props || !valueChild.props.value
          ? undefined
          : this.anchorFrom(valueChild.props.value.toLowerCase().replace(/ /g, '-'))
      return React.createElement(
        `h${level}`,
        Object.assign({}, props, {
          'data-markdown-anchor': anchor,
          'data-is-href': valueChild && valueChild.props && valueChild.props.href
        }),
        props.children
      )
    }

    console.error('this.props', this.props.source)
    return (
      <MarkdownToJSX
        className={
          this.props.className || 'padding-content scrollable scrollable-x scrollable-auto marked-content page-content'
        }
        options={{
          overrides: {
            a: props => {
              const isLocal = !/^http/i.test(props.href)
              const target = !isLocal ? '_blank' : undefined
              const href = isLocal ? '#' : props.href
              const onClick = !isLocal
                ? undefined
                : async () => {
                    let file = props.href
                    if (props.href.startsWith('#kuiexec?command=')) {
                      const cmdline = decodeURIComponent(props.href.slice('#kuiexec?command='.length))
                      if (cmdline) {
                        return this.props.repl.pexec(cmdline)
                      }
                    } else if (props.href.charAt(0) === '#') {
                      const elt = this.props.tab.querySelector(
                        `[data-markdown-anchor="${this.anchorFrom(props.href.slice(1))}"]`
                      )
                      if (elt) {
                        return elt.scrollIntoView()
                      }
                    } else if (this.props.fullpath) {
                      const absoluteHref = join(dirname(this.props.fullpath), props.href)
                      const relativeToCWD = relative(process.cwd() || process.env.PWD, absoluteHref)
                      file = relativeToCWD
                    }
                    return this.props.repl.pexec(`open ${this.props.repl.encodeComponent(file)}`)
                  }

              const link = <Link {...props} href={href} target={target} onClick={onClick} />
              return link
            },
            code: props => <CodeSnippet value={props.children} onCopy={this.onCopy.bind(this, props.value)} />,
            h1: props => heading(props, 1),
            h2: props => heading(props, 2),
            h3: props => heading(props, 3),
            h4: props => heading(props, 4),
            h5: props => heading(props, 5),
            h6: props => heading(props, 6),
            img: props => {
              const isLocal = !/^http/i.test(props.src)
              if (isLocal && this.props.fullpath) {
                const absoluteSrc = join(dirname(this.props.fullpath), props.src)
                const relativeToCWD = relative(process.cwd() || process.env.PWD, absoluteSrc)
                return <img src={relativeToCWD} />
              } else {
                return <img {...props} />
              }
            },
            ul: list,
            ol: list,
            li: props => <ListItem className={props.className}>{props.children}</ListItem>,
            table: props => <StructuredListWrapper className={props.className}>{props.children}</StructuredListWrapper>,
            thead: props => <StructuredListHead className={props.className}>{props.children}</StructuredListHead>,
            tbody: props => <StructuredListBody className={props.className}>{props.children}</StructuredListBody>,
            tr: props => (
              <StructuredListRow head={props.isHeader} className={props.className}>
                {props.children}
              </StructuredListRow>
            ),
            td: tableCell,
            th: tableCell
          }
        }}
      >
        {this.props.source}
      </MarkdownToJSX>
    )
  }
}
