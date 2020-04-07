'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true
})
exports.default = exports.printEmoji = void 0
const dogInSidecar = {
  metadata: {
    name: 'hello'
  },
  kind: 'image',
  modes: [
    {
      mode: 'hello',
      label: 'Hello!',
      content:
        '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar4.png)](http://kui.tools)\n\n',
      contentType: 'text/markdown'
    }
  ]
}

const doHello = () => dogInSidecar

const printEmoji = () => args => {
  if (args.argvNoOptions.length === 2 && args.argvNoOptions[1] === 'cat') {
    return '🐱'
  } else {
    return '🐶'
  }
}

exports.printEmoji = printEmoji
const catInLeftNavSidecar = {
  apiVersion: 'kui-shell/v1',
  kind: 'NavResponse',
  menus: [
    {
      label: 'Hello Paws!',
      items: [
        {
          mode: 'cat',
          content:
            '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar.png)](http://kui.tools)\n\n',
          contentType: 'text/markdown'
        },
        {
          mode: 'dog',
          content:
            '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar.png)](http://kui.tools)\n\n',
          contentType: 'text/markdown'
        }
      ]
    },
    {
      label: 'Goodbye Paws!',
      items: [
        {
          mode: 'cat',
          content:
            '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar.png)](http://kui.tools)\n\n',
          contentType: 'text/markdown'
        },
        {
          mode: 'dog',
          content:
            '**Kui** is a platform for enhancing the terminal experience with visualizations. It provides users a modern alternative to ASCII terminals and web-based consoles. It provides tool developers an opportunity to unify these experiences.\n\n[![Kui: The CLI with a GUI twist](images/tumble-sidecar.png)](http://kui.tools)\n\n',
          contentType: 'text/markdown'
        }
      ]
    }
  ]
}

var _default = commandTree => {
  commandTree.listen('/hello', printEmoji())
}

exports.default = _default
