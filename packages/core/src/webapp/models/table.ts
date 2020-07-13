/*
 * Copyright 2019-2020 IBM Corporation
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

import { ReactElement } from 'react'
import { Breadcrumb } from '../../models/NavResponse'
import { MetadataBearing, Entity } from '../../models/entity'

export class Row {
  attributes?: Cell[]

  /** uniquely identifies this row in a given table; if not defined, we will use the name field as the row key */
  rowKey?: string

  /** the key-value pair for the first column */
  key?: string
  name: string

  nameDom?: Element

  /** does this row represent a recently deleted resource? */
  isDeleted?: boolean

  type?: string

  packageName?: string

  prettyType?: string

  fontawesome?: string

  fontawesomeCSS?: string

  setSelected?: () => void

  setUnselected?: () => void

  nameCss?: string | string[]

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

  valueDom?: ReactElement

  css?: string

  outerCSS?: string

  onclick?: any // eslint-disable-line @typescript-eslint/no-explicit-any

  key?: string

  fontawesome?: string[] | string

  tag?: string

  tagClass?: string

  innerClassName?: string

  className?: string

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

  footer?: string[]

  noSort?: boolean

  noEntityColors?: boolean

  title?: string
  breadcrumbs?: Breadcrumb[] | (() => Breadcrumb[])

  flexWrap?: number | boolean

  tableCSS?: string

  fontawesome?: string

  fontawesomeCSS?: string

  fontawesomeBalloon?: string

  constructor(table: Table) {
    Object.assign(this, table)
  }
}

export function isTable<C>(model: MetadataBearing<C> | Entity): model is Table {
  return (
    model !== undefined &&
    (model instanceof Table || ((model as Table).body !== undefined && Array.isArray((model as Table).body)))
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
