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

import { eventBus, ModificationState, TreeItem } from '@kui-shell/core'
import { TreeView, TreeViewDataItem } from '@patternfly/react-core'
import { Props } from '../'
import Tag from '../../../spi/Tag/impl/PatternFly'
import Events from '../../../Content/Events'

import '../../../../../web/scss/components/Tree/index.scss'

interface State {
  activeItem: TreeItem
}

export default class KuiTreeView extends React.PureComponent<Props, State> {
  public constructor(props) {
    super(props)

    this.state = {
      activeItem: this.props.data[0]
    }
  }

  public static getDerivedStateFromProps(props: Props, state: State) {
    if (props.toolbarText) {
      props.willUpdateToolbar(props.toolbarText)
    }
    return state
  }

  private diffTag(item: TreeItem) {
    if (
      !item.children &&
      item.modification !== undefined &&
      item.modification !== ModificationState.UNCHANGED &&
      item.customizedBadge
    ) {
      const getCss = (state: ModificationState) => {
        if (state === ModificationState.ADDED) {
          return 'green-background'
        } else if (state === ModificationState.DELETED) {
          return 'red-background'
        } else if (state === ModificationState.CHANGED) {
          return 'yellow-background'
        } else {
          return ''
        }
      }
      return <Tag className={getCss(item.modification)}>{item.customizedBadge}</Tag>
    }
  }

  private kuiTreeItemsToView(kuiTreeItems: TreeItem[]) {
    const getModificationFromNodes = (treeItem: TreeItem[], isLeafNode?: boolean) => {
      const totalNum = treeItem.length

      const record = [0, 0, 0, 0]
      treeItem.forEach(({ modification }) => {
        if (modification === ModificationState.ADDED) {
          record[ModificationState.ADDED]++
        } else if (modification === ModificationState.DELETED) {
          record[ModificationState.DELETED]++
        } else if (modification === ModificationState.CHANGED) {
          record[ModificationState.CHANGED]++
        } else {
          record[ModificationState.UNCHANGED]++
        }
      })

      const getText = () => {
        if (
          !record[ModificationState.ADDED] &&
          !record[ModificationState.DELETED] &&
          !record[ModificationState.CHANGED]
        ) {
          return totalNum.toString()
        } else {
          const nodes = record
            .map((num, idx) => {
              if (num !== 0) {
                if (idx === ModificationState.ADDED) {
                  return `${num} new`
                } else if (idx === ModificationState.DELETED) {
                  return `${num} deleted`
                } else if (idx === ModificationState.CHANGED) {
                  return `${num} changed`
                }
              }
            })
            .filter(_ => _)

          if (nodes.length !== 0) {
            const text = nodes.join(', ')
            if (isLeafNode) {
              return text.replace(`${totalNum} `, '')
            } else {
              if (nodes.length > 1) {
                return `${totalNum.toString()} ( ${text} )`
              } else {
                return text
              }
            }
          }
        }
      }

      const getTotalModification = () => {
        if (
          !record[ModificationState.ADDED] &&
          !record[ModificationState.DELETED] &&
          !record[ModificationState.CHANGED]
        ) {
          return ModificationState.UNCHANGED
        } else if (
          record[ModificationState.ADDED] &&
          !record[ModificationState.DELETED] &&
          !record[ModificationState.CHANGED]
        ) {
          return ModificationState.ADDED
        } else if (
          record[ModificationState.DELETED] &&
          !record[ModificationState.ADDED] &&
          !record[ModificationState.CHANGED]
        ) {
          return ModificationState.DELETED
        } else if (
          record[ModificationState.CHANGED] &&
          !record[ModificationState.ADDED] &&
          !record[ModificationState.DELETED]
        ) {
          return ModificationState.CHANGED
        } else {
          return ModificationState.CHANGED
        }
      }

      const totalModification = getTotalModification()

      return { text: getText(), modification: totalModification }
    }

    const prepTree = (items: TreeItem[]) => {
      return items.map(item => {
        if (item.children) {
          const children = prepTree(item.children)
          const { text, modification } = getModificationFromNodes(children)
          item.customizedBadge = text
          item.modification = modification
          return item
        } else {
          const { text, modification } = getModificationFromNodes([item], true)
          item.customizedBadge = text
          item.modification = modification
          return item
        }
      })
    }

    /**
     * transform kui TreeItem[] to TreeViewDataItem[]
     * 1. remove content & modifiedContent from each TreeItem for memory in TreeView
     * 2. we used to render the content of each tree node in an editor (or diffEditor)
     *    but this feature is replaced by item.onclick command
     *    NOTE: maybe we can remove the content & modifiedContent from the TreeItem
     *
     */
    const kuiTreeItemToView = (item: TreeItem): TreeViewDataItem => {
      return Object.assign({}, item, {
        action:
          !item.children &&
          item.modification !== undefined &&
          item.modification !== ModificationState.UNCHANGED &&
          item.customizedBadge &&
          this.diffTag(item),
        checkProps: item.hasBadge && item.customizedBadge ? { isRead: true, 'data-badge': item.customizedBadge } : {},
        content: undefined,
        modifiedContent: undefined
      })
    }

    const prep = prepTree(kuiTreeItems)
    return prep.map(kuiTreeItem => {
      const treeViewDataItem = kuiTreeItemToView(kuiTreeItem)
      if (kuiTreeItem.children) {
        treeViewDataItem.children = this.kuiTreeItemsToView(kuiTreeItem.children)
      }
      return treeViewDataItem
    })
  }

  private tree() {
    const data = this.kuiTreeItemsToView(this.props.data)
    return (
      <TreeView
        data={data}
        activeItems={[this.state.activeItem]}
        onSelect={(_, treeViewItem) => {
          const item = treeViewItem as TreeItem
          if (item.onclickEvents) {
            console.error('throwing events', item)
            eventBus.emitCommandStart(item.onclickEvents.startEvent)
            eventBus.emitCommandComplete(item.onclickEvents.completeEvent)
          } else if (item.onclick) {
            console.error('executing command', item)
            this.props.tab.REPL.pexec(item.onclick)
          }
          this.setState({ activeItem: item })
        }}
      />
    )
  }

  private events() {
    if (this.state.activeItem.eventArgs) {
      const { command, schema } = this.state.activeItem.eventArgs

      return (
        <Events
          tab={this.props.tab}
          command={command}
          schema={schema}
          involvedObjects={this.state.activeItem.extends}
        />
      )
    }
  }

  private customizeBadgeContent() {
    try {
      const allBadges = document.querySelectorAll(
        `.repl-block[data-uuid="${this.props.execUUID}"][data-scrollback-uuid="${this.props.tab.uuid}"] .pf-c-tree-view__node-count .pf-c-badge`
      )
      allBadges.forEach(_ => {
        const badge = _ as HTMLElement
        const text = badge.getAttribute('data-badge')
        if (text) {
          badge.innerText = text
        }
      })
    } catch (err) {
      console.error('failed to customize the badge', err)
    }
  }

  public componentDidUpdate() {
    this.customizeBadgeContent()
  }

  public componentDidMount() {
    this.customizeBadgeContent()
  }

  public render() {
    return (
      <div className="kui--tree kui--full-height">
        <div className="kui--tree-nav-and-body kui--full-height kui--rows">{this.tree()}</div>
        {this.events()}
      </div>
    )
  }
}
