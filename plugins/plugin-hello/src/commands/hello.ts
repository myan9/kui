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

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Arguments, Registrar, MultiModalResponse, ParsedOptions, NavResponse } from '@kui-shell/core'

const dogInSidecar: MultiModalResponse = {
  metadata: { name: '🐱' },
  kind: 'Top',
  modes: [
    {
      mode: 'Cat Tab',
      content:
        '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar4.png)](http://kui.tools)\n\n',
      contentType: 'text/markdown'
    },
    {
      mode: 'Dog Tab',
      content:
        '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar4.png)](http://kui.tools)\n\n',
      contentType: 'text/markdown'
    }
  ]
}

interface Options extends ParsedOptions {
  animal: string
  count: number
}

// Arguments accepts an optional type argument that
// allows you to define the types of your optional arguments
const doHello = () => dogInSidecar

export const printEmoji = () => (args: Arguments) => {
  if (args.argvNoOptions.length === 2 && args.argvNoOptions[1] === 'cat') {
    return '🐱'
  } else {
    return '🐶'
  }
}

const catInLeftNavSidecar: NavResponse = {
  apiVersion: 'kui-shell/v1',
  kind: 'NavResponse',
  breadcrumbs: [{ label: 'LeftNav' }, { label: 'Cat' }, { label: '🐱' }],
  menus: [
    {
      label: 'Cat',
      items: [
        {
          mode: '🐱',
          content:
            '### Hello!\n #### **Kui** is a platform for enhancing the terminal experience with visualizations.\n\n ![Kui: The CLI with a GUI twist](images/tumble-sidecar4.png)',
          contentType: 'text/markdown'
        },
        {
          mode: '🐈',
          content:
            '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar.png)](http://kui.tools)\n\n',
          contentType: 'text/markdown'
        }
      ]
    },
    {
      label: 'Dog',
      items: [
        {
          mode: '🐶',
          content:
            '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar.png)](http://kui.tools)\n\n',
          contentType: 'text/markdown'
        },
        {
          mode: '🐕',
          content:
            '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar.png)](http://kui.tools)\n\n',
          contentType: 'text/markdown'
        }
      ]
    }
  ]
}

export default (commandTree: Registrar) => {
  commandTree.listen('/hello', printEmoji())
}
