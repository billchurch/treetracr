import chalk from 'chalk'

// Output abstraction layer
export const output = {
  // Regular output
  print: (message) => console.log(message),
  
  // Different log levels
  info: (message) => console.log(chalk.blue(message)),
  success: (message) => console.log(chalk.green(message)),
  warning: (message) => console.log(chalk.yellow(message)),
  error: (message) => console.error(chalk.red('Error:'), message),
  
  // Section headers
  section: (title) => {
    console.log(chalk.cyan('\n============================================='))
    console.log(chalk.cyan(title))
    console.log(chalk.cyan('============================================='))
  },
  
  // Tree visualization
  tree: (treeOutput) => console.log(treeOutput)
}
