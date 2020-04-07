'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true
})
exports.default = void 0

var _showCat = _interopRequireDefault(require('./view/status-stripe/show-cat'))

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj }
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

var _default = registrar =>
  __awaiter(void 0, void 0, void 0, function*() {
    yield registrar.registerModes(_showCat.default)
  })

exports.default = _default
