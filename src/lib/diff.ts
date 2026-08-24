import * as diff from 'diff';

export function calculateDiff(originalCode: string, modifiedCode: string): string {
  if (!originalCode && !modifiedCode) return '';
  
  const differences = diff.diffLines(originalCode, modifiedCode);
  
  let diffOutput = '';
  
  differences.forEach((part) => {
    if (part.added) {
      diffOutput += part.value.split('\\n').map(line => `+ ${line}`).join('\\n') + '\\n';
    } else if (part.removed) {
      diffOutput += part.value.split('\\n').map(line => `- ${line}`).join('\\n') + '\\n';
    } else {
      const lines = part.value.split('\\n');
      if (lines.length > 6) {
        diffOutput += `  ${lines[0]}\\n  ${lines[1]}\\n  ... [${lines.length - 4} linhas inalteradas ocultadas] ...\\n  ${lines[lines.length - 3]}\\n  ${lines[lines.length - 2]}\\n`;
      } else {
        diffOutput += part.value.split('\\n').map(line => `  ${line}`).join('\\n') + '\\n';
      }
    }
  });

  return diffOutput.trim();
}
