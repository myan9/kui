import { Registrar } from '@kui-shell/core'
import sayHello from './commands/hello'

export default async (commandTree: Registrar) => {
  await sayHello(commandTree)
}
