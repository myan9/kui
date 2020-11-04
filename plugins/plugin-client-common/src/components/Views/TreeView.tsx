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
  TreeViewDataItem as KuiTreeViewDataItem,
} from '@kui-shell/core'
import Editor from '../Content/Editor'
import Events from './Events'

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

    const data = this.kuiToPF(this.props.data)

    console.error('tree.data', data)

    this.state = {
      data,
      activeItem: data[0],
      activeItemParent: data[0]
    }
  }

  /** Add `id` field to data, for TreeView to distinguish items */
  private kuiToPF(data: KuiTreeViewDataItem[]) {
    return data.map(item => {
      // FIXME: might not needed
      if (item.id === undefined) {
        item.id = uuid() 
      }

      if (item.children && item.children.length !== 0) {
        item.children = this.kuiToPF(item.children)
      }

      return item
    })
  }

  protected editor() {
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
            const activeItemParent = parentItem ? this.findItemInList(parentItem.id) : activeItem

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

  private events() {
    if (this.state.activeItem.eventArgs){
      return <Events 
        command={this.state.activeItem.eventArgs.command}
        involvedNames={this.state.activeItem.eventArgs.name}
        involvedKinds={this.state.activeItem.eventArgs.kind}
        tab={this.props.tab} 
      />
    }
  }

  public render() {
    return (
      <div className="kui--treeview">
        <div className="kui--treeview-body">
          {this.tree()}
          {this.editor()}
        </div>
        {this.events()}
      </div>
    )
  }
}
