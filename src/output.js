import chalk from 'chalk'
import boxen from 'boxen'
import ora from 'ora'

// Output abstraction layer
export const output = {
  // Regular output
  print: (message) => console.log(message),
  
  // Different log levels
  info: (message) => console.log(chalk.blue(message)),
  success: (message) => console.log(chalk.green(message)),
  warning: (message) => console.log(chalk.yellow(message)),
  error: (message) => console.error(chalk.red('Error:'), message),
  
  // Enhanced section with boxen
  section: (title) => {
    console.log(boxen(chalk.cyan(title), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }))
  },
  
  // Tree visualization
  tree: (treeOutput) => console.log(treeOutput),
  
  // Progress spinner
  spinner: (text) => {
    const spinner = ora(text).start()
    return {
      succeed: (message) => spinner.succeed(message),
      fail: (message) => spinner.fail(message),
      update: (message) => spinner.text = message
    }
  }
}