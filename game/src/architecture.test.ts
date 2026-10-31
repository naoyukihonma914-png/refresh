import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) && !path.endsWith('.test.ts') && !path.endsWith('.d.ts') ? [path] : [];
  });
}

describe('段階1の境界', () => {
  it('ブラウザへの直接アクセスはプラットフォーム内に収める', () => {
    for (const path of sourceFiles('src').filter(path => !path.startsWith('src/platform/'))) {
      const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const violations: string[] = [];
      function visit(node: ts.Node) {
        if (ts.isIdentifier(node) && ['window', 'document', 'navigator', 'localStorage', 'performance'].includes(node.text)) violations.push(node.text);
        if (ts.isPropertyAccessExpression(node) && node.getText(file) === 'Date.now') violations.push('Date.now');
        ts.forEachChild(node, visit);
      }
      visit(file);
      expect(violations, path).toEqual([]);
    }
  });

  it('画面の本文と操作ラベルをJSXに直書きしない', () => {
    for (const path of sourceFiles('src').filter(path => path.endsWith('.tsx'))) {
      const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const literals: string[] = [];
      function visit(node: ts.Node) {
        if (ts.isJsxText(node) && node.text.trim()) literals.push(node.text.trim());
        if (ts.isJsxAttribute(node) && ['title', 'placeholder', 'aria-label'].includes(node.name.getText(file))
          && node.initializer && ts.isStringLiteral(node.initializer)) literals.push(node.initializer.text);
        ts.forEachChild(node, visit);
      }
      visit(file);
      expect(literals, path).toEqual([]);
    }
  });
});
