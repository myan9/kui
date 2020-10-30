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
import { TreeView } from '@patternfly/react-core' // FIXME from spi
import { v4 as uuid } from 'uuid'

import {
  Arguments,
  ParsedOptions,
  MultiModalResponse,
  Tab,
  TreeViewDataItem as KuiTreeViewDataItem
} from '@kui-shell/core'
import Editor from '../Content/Editor'

import '../../../web/scss/components/TreeView/TreeView.scss'

interface State {
  data: KuiTreeViewDataItem[]
  activeItem: KuiTreeViewDataItem
  activeItemParent: KuiTreeViewDataItem
}

interface Props {
  response: MultiModalResponse
  tab: Tab
  data: KuiTreeViewDataItem[]
  args: {
    argsForMode?: Arguments
    argvNoOptions: string[]
    parsedOptions: ParsedOptions
  }
}

export default class KuiTreeView extends React.PureComponent<Props, State> {
  public constructor(props) {
    super(props)

    const data = this.addId(this.props.data)

    this.state = {
      data,
      activeItem: data[0],
      activeItemParent: data[0]
    }
  }

  /** Add `id` field to data, for TreeView to distinguish items */
  private addId(data: KuiTreeViewDataItem[]) {
    return data.map(item => {
      if (item.id === undefined) {
        item.id = uuid()
      }

      if (item.children && item.children.length !== 0) {
        item.children = this.addId(item.children)
      } else {
        item.children = undefined
      }

      return item
    })
  }

  protected content() {
    return (
      <React.Suspense fallback={<div />}>
        <Editor
          key={this.state.activeItem.id}
          content={{ content: this.state.activeItem.content, contentType: this.state.activeItem.contentType }}
          readOnly={false}
          sizeToFit
          response={this.props.response}
          repl={this.props.tab.REPL}
          tabUUID={this.props.tab.uuid}
        />
      </React.Suspense>
    )
  }

  /** find KuiTreeViewDataItem by id */
  private findItemInList(id: string) {
    let found: KuiTreeViewDataItem
    const find = (items: KuiTreeViewDataItem[]) => {
      items.forEach(item => {
        if (item.id === id) {
          found = item
        } else if (item.children) {
          find(item.children)
        }
      })
    }

    find(this.state.data)
    return found
  }

  private tree() {
    return (
      <TreeView
        data={this.state.data}
        activeItems={[this.state.activeItem, this.state.activeItemParent]}
        onSelect={(evt, treeViewItem, parentItem) => {
          this.setState(() => {
            const activeItem = this.findItemInList(treeViewItem.id)
            const activeItemParent = this.findItemInList(parentItem.id)

            return {
              activeItem,
              activeItemParent
            }
          })
        }}
        hasBadges
      />
    )
  }

  public render() {
    return (
      <div className="kui--treeview">
        {this.tree()}
        {this.content()}
      </div>
    )
  }
}
