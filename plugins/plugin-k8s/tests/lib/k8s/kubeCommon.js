const ui = require('@kui-shell/core/tests/lib/ui')
const common = require('@kui-shell/core/tests/lib/common')

exports.before = (ctx, { fuzz, noApp = false } = {}) => {
  ctx.retries(10)

  return function () {
    const { cli } = ui

    const addKubeAuth = () => cli.do(`k8s auth add`, ctx.app)
      .then(() => cli.paste(process.env.KUI_KUBECONFIG, ctx.app)) // TODO: KUI_KUBECONFIG is not intuitive
      .catch(common.oops(ctx)) // TODO: check local storage credentials ok

    return Promise.resolve()
      .then(common.before(ctx, { fuzz, noApp }))
      .then(addKubeAuth)
  }
}
