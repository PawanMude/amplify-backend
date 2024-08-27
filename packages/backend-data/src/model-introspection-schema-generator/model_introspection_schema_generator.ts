import path from 'path';
import { fileURLToPath } from 'url';
import { execaSync } from 'execa';

/**
 * TODO
 */
export class ModelIntrospectionSchemaGenerator {
  generate = (schema: string): string => {
    const currentScriptDir = path.dirname(fileURLToPath(import.meta.url));
    const executablePath = path.join(
      currentScriptDir,
      'model_introspection_schema_generator_executable.js'
    );

    const execaResult = execaSync('node', [executablePath], {
      cwd: currentScriptDir,
      input: schema,
    });
    if (execaResult.failed) {
      throw new Error(`Could not generate MIS ${execaResult.stderr}`);
    }

    return execaResult.stdout;
  };
}
