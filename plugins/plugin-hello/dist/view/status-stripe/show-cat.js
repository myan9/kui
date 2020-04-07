'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true
})
exports.default = void 0
var _default = {
  when: resource => {
    return resource.kind === 'animal' && resource.metadata.name === 'puppy'
  },
  mode: {
    mode: 'hello-kitty',
    label: 'Show Cat',
    kind: 'drilldown',
    command: () => {
      return `hello kitty`
    }
  }
}
exports.default = _default
