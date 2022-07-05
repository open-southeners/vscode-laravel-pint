import { ProviderResult, ShellExecution, Task, TaskDefinition, TaskProvider, TaskScope } from "vscode";
import { buildCommandFromConfig } from "./util";

interface PintTaskDefinition extends TaskDefinition {
	/**
	 * The path to be formatted by Laravel Pint
	 */
	path?: string;
}

export class PintTaskProvider implements TaskProvider {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static PintType = 'pint';

  provideTasks(): ProviderResult<Task[]> {
    return getFormatTasks();
  }

  resolveTask(task: Task): ProviderResult<Task> {
    return new Promise(async (resolve, reject) => {
      const taskDefinition: PintTaskDefinition = task.definition;
      const commandParts = await buildCommandFromConfig(taskDefinition.path);
      
      if (!commandParts) {
        return reject('Incorrect path');
      }

      const [command, ...commandArgs] = commandParts;

      task.execution = new ShellExecution(command, commandArgs);

      return resolve(task);
    });
  }
}

export async function getFormatTasks() {
  const [command, ...commandArgs] = await buildCommandFromConfig();

  return [
    new Task(
      { type: PintTaskProvider.PintType },
      TaskScope.Workspace,
      'Format PHP files',
      'pint',
      new ShellExecution(command, commandArgs),
      '$pint'
    )
  ];
}