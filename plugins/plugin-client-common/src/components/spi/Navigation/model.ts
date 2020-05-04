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

import { Button, Link, MultiModalMode, NavResponse, Tab } from '@kui-shell/core'
import { BaseHistoryEntry } from '../../Views/util/CircularBuffer'

interface Nav {
  title: string
  currentTabIndex: number
  tabs: MultiModalMode[]
  buttons?: Button[]
}

export interface HistoryEntry extends BaseHistoryEntry {
  current: { menuIdx: number; tabIdx: number }
  allNavs: Nav[]
  allLinks: Link[]

  response: NavResponse
}

interface Props {
  tab: Tab
  current: HistoryEntry
  changeCurrent: (menuIdx: number, tabIdx: number) => void
}

export default Props
