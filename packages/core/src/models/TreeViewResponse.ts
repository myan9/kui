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

import { Entity } from './entity'
import { SupportedStringContent } from './mmr/content-types'

// NTOE: `TreeViewDataItem` is the same with `TreeViewDataItem` of @patternfly/react-core
export type TreeViewDataItem = {
  /** content name of a tree view item */
  name: React.ReactNode
  /** ID of a tree view item */
  id?: string
  /** Child nodes of a tree view item */
  children?: TreeViewDataItem[]
  /** Flag indicating if node is expanded by default */
  defaultExpanded?: boolean
  /** Default icon of a tree view item */
  icon?: React.ReactNode
  /** Expanded icon of a tree view item */
  expandedIcon?: React.ReactNode
  /** Flag indicating if a tree view item has a checkbox */
  hasCheck?: boolean
  /** Additional properties of the tree view item checkbox */
  checkProps?: any
  /** Flag indicating if a tree view item has a badge */
  hasBadge?: boolean
  /** Additional properties of the tree view item badge */
  badgeProps?: any
  /** Action of a tree view item, nested inside a button */
  action?: React.ReactNode
  /** Additional properties of the tree view item action button */
  actionProps?: any
} & TreeViewContent

// FIXME: use mmr/content-type
type TreeViewContent = {
  content: string
  contentType: SupportedStringContent
}

export interface TreeViewResponse {
  apiVersion: 'kui-shell/v1'
  kind: 'TreeViewResponse'
  data: TreeViewDataItem[]
}

export function isTreeViewResponse(entity: Entity): entity is TreeViewResponse {
  const tree = entity as TreeViewResponse
  return (
    tree.apiVersion === 'kui-shell/v1' &&
    tree.kind === 'TreeViewResponse' &&
    tree.data &&
    Array.isArray(tree.data) &&
    tree.data.length > 0
  )
}
