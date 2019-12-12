/*
 * Copyright 2019 IBM Corporation
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

/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { Watchable, Poller } from '../../core/jobs/watchable'
import { MetadataBearing, Entity } from '../../models/entity'
import { SidecarMode } from '../bottom-stripe'

export class Row {
  attributes?: Cell[]

  name: string

  nameDom?: Element

  type?: string

  packageName?: string

  prettyType?: string

  fontawesome?: string

  fontawesomeCSS?: string

  setSelected?: () => void

  setUnselected?: () => void

  nameCss?: string | string[]

  key?: string

  prettyName?: string

  fullName?: string

  kind?: string

  prettyKind?: string

  status?: string

  version?: string

  prettyVersion?: string

  beforeAttributes?: Cell[]

  rowCSS?: string | string[]

  onclickSilence?: boolean

  onclickExec?: 'pexec' | 'qexec'

  onclick?: any // eslint-disable-line @typescript-eslint/no-explicit-any

  css?: string

  outerCSS?: string

  done?: boolean

  constructor(row: Row) {
    Object.assign(this, row)
  }
}

export class Cell {
  value: string

  valueDom?: Node[] | Node

  css?: string

  outerCSS?: string

  onclick?: any // eslint-disable-line @typescript-eslint/no-explicit-any

  key?: string

  fontawesome?: string[] | string

  tag?: string

  tagClass?: string

  innerClassName?: string

  className?: string

  parent?: HTMLElement

  constructor(cell: Cell) {
    Object.assign(this, cell)
  }
}

export interface Button {
  name: string
  fontawesome: string
  balloon?: string
  onclick: (evt: Event) => void | string
}

export interface Footer {
  leftButtons: Button[]
}

export enum TableStyle {
  Light,
  Medium,
  Heavy
}

export class Table<RowType extends Row = Row> {
  body: RowType[]

  // type?: string

  style?: TableStyle

  header?: RowType

  footer?: Footer

  noSort?: boolean

  noEntityColors?: boolean

  title?: string

  flexWrap?: number | boolean

  tableCSS?: string

  fontawesome?: string

  fontawesomeCSS?: string

  fontawesomeBalloon?: string

  constructor(table: Table) {
    Object.assign(this, table)
  }
}

export function isTable<C>(model: SidecarMode | MetadataBearing<C> | Entity): model is Table {
  return (
    model !== undefined && (model instanceof Table || ((model as Table).body && Array.isArray((model as Table).body)))
  )
}

export function formatWatchableTable<T extends Table>(model: T, poller: Poller): T & Watchable {
  const watch: Watchable = { watch: poller }
  if (isTable(model)) {
    return Object.assign(model, watch)
  } else {
    // TODO: we might need to consider the variance of model, throw error for now
    throw new Error('models other than table(s) are not supported in watch mode yet')
  }
}

/**
 * sort the body of table
 *
 */
export const sortBody = (rows: Row[]): Row[] => {
  return rows.sort(
    (a, b) =>
      (a.prettyType || a.type || '').localeCompare(b.prettyType || b.type || '') ||
      (a.packageName || '').localeCompare(b.packageName || '') ||
      a.name.localeCompare(b.name)
  )
}

export class Icon {
  fontawesome: string

  onclick?: (evt: Event) => void

  balloon?: string

  balloonLength?: string

  balloonPos?: string

  constructor(icon: Icon) {
    Object.assign(this, icon)
  }
}
