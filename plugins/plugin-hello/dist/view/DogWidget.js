'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true
})
exports.default = void 0

var React = _interopRequireWildcard(require('react'))

var _core = require('@kui-shell/core')

var _pluginClientCommon = require('@kui-shell/plugin-client-common')

function _getRequireWildcardCache() {
  if (typeof WeakMap !== 'function') return null
  var cache = new WeakMap()
  _getRequireWildcardCache = function() {
    return cache
  }
  return cache
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj
  }
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return { default: obj }
  }
  var cache = _getRequireWildcardCache()
  if (cache && cache.has(obj)) {
    return cache.get(obj)
  }
  var newObj = {}
  var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null
      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc)
      } else {
        newObj[key] = obj[key]
      }
    }
  }
  newObj.default = obj
  if (cache) {
    cache.set(obj, newObj)
  }
  return newObj
}

var __awaiter =
  (void 0 && (void 0).__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function(resolve) {
            resolve(value)
          })
    }

    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }

      function rejected(value) {
        try {
          step(generator['throw'](value))
        } catch (e) {
          reject(e)
        }
      }

      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected)
      }

      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }

const strings = (0, _core.i18n)('plugin-bash-like')

class DogWidget extends React.PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      text: '',
      viewLevel: 'hidden'
    }
  }

  reportCurrentBranch() {
    return __awaiter(this, void 0, void 0, function*() {
      const tab = (0, _core.getCurrentTab)()

      if (!tab || !tab.REPL) {
        return
      }

      try {
        const [isDirty, branch] = yield Promise.all([
          tab.REPL.qexec('git diff-index --quiet HEAD --')
            .then(() => false)
            .catch(() => true),
          tab.REPL.qexec('git rev-parse --abbrev-ref HEAD')
        ])
        this.setState({
          text: branch,
          viewLevel: isDirty ? 'warn' : 'normal'
        })
      } catch (error) {
        const err = error

        if (err.code !== 128) {
          console.error('unable to determine git branch', err.code, typeof err.code, err)
        }

        this.setState({
          text: strings('not a repo'),
          viewLevel: 'hidden'
        })
      }
    })
  }

  componentDidMount() {
    this.reportCurrentBranch()
    ;(0, _core.wireToStandardEvents)(this.reportCurrentBranch.bind(this))
  }

  render() {
    return React.createElement(
      _pluginClientCommon.TextWithIconWidget,
      {
        className: this.props.className,
        text: '🐶',
        viewLevel: this.state.viewLevel,
        id: 'kui--plugin-git--current-git-branch',
        textOnclick: 'hello dog',
        iconOnclick: 'hello cat'
      },
      '🐱'
    )
  }
}

exports.default = DogWidget
