import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.endsWith('.d.ts') ? [path] : [];
  });
}

// Symbols distinguish browser globals from a model's document/performance fields,
// local parameters, imports and JSX props, even when they use the same spelling.
function browserBoundaryViolations(program: ts.Program, file: ts.SourceFile): string[] {
  const checker = program.getTypeChecker();
  const browserNames = new Set(['window', 'document', 'navigator', 'localStorage', 'performance']);
  const violations: string[] = [];
  const defaultDeclaration = (declaration: ts.Declaration) => program.isSourceFileDefaultLibrary(declaration.getSourceFile());
  const restricted = (symbol: ts.Symbol | undefined): boolean => !!symbol?.declarations?.some(declaration =>
    defaultDeclaration(declaration) && (browserNames.has(symbol.name)
      || symbol.name === 'now' && ts.isInterfaceDeclaration(declaration.parent) && declaration.parent.name.text === 'DateConstructor'));
  function typeOnly(node: ts.Node): boolean {
    for (let parent = node.parent; parent; parent = parent.parent) if (ts.isTypeNode(parent)) return true;
    return false;
  }
  function check(node: ts.Node, symbol: ts.Symbol | undefined) {
    if (restricted(symbol) && !typeOnly(node)) violations.push(node.getText(file));
  }
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && !(ts.isBindingElement(node.parent) && node.parent.propertyName === node)) {
      const symbol = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
      check(node, symbol);
    }
    // Computed access and destructuring must keep the same boundary as dot access.
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      check(node, checker.getPropertyOfType(checker.getTypeAtLocation(node.expression), node.argumentExpression.text));
    }
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const key = node.propertyName ?? (ts.isIdentifier(node.name) ? node.name : undefined);
      if (key && (ts.isIdentifier(key) || ts.isStringLiteralLike(key))) {
        check(node, checker.getPropertyOfType(checker.getTypeAtLocation(node.parent), key.text));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return violations;
}

function compilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(config.config, ts.sys, '.').options;
}

function snippetViolations(text: string): string[] {
  const options = compilerOptions(), host = ts.createCompilerHost(options), original = host.getSourceFile;
  const path = resolve('src/architecture-scope-fixture.tsx');
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => resolve(name) === path
    ? ts.createSourceFile(path, `export {};\n${text}`, languageVersion, true, ts.ScriptKind.TSX)
    : original(name, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([path], options, host);
  return browserBoundaryViolations(program, program.getSourceFile(path)!);
}

describe('段階1の境界', () => {
  it('ブラウザへの直接アクセスはプラットフォーム内に収める', () => {
    const program = ts.createProgram(sourceFiles('src'), compilerOptions());
    for (const path of sourceFiles('src').filter(path => !path.startsWith('src/platform/'))) {
      expect(browserBoundaryViolations(program, program.getSourceFile(path)!), path).toEqual([]);
    }
  }, 20_000);

  it('同名のローカル変数・モデルの項目・JSX props・型だけの参照を誤検出しない', () => {
    expect(snippetViolations(`
      type BrowserDocument = typeof document;
      function local(document: { id: string }, window: number, performance: number) {
        const report = { document, window, performance };
        const Date = { now: () => window };
        return [report.document.id, report.performance, Date.now()];
      }
      const Model = (props: { document: string }) => <section>{props.document}</section>;
      const node = <Model document="saved" />;
      const records = [{ id: 'saved' }].map(document => document.id);
    `)).toEqual([]);
  });

  it('ブラウザglobalは省略記法・globalThis・分割代入でも検出する', () => {
    const violations = snippetViolations(`
      window.location; document.title; navigator.language; localStorage.length; performance.now(); Date.now();
      const leak = { document };
      globalThis.document.title; globalThis['performance'].now();
      const { document: savedDocument, navigator: savedNavigator } = globalThis;
      const clock = Date; clock.now();
    `);
    for (const name of ['window', 'document', 'navigator', 'localStorage', 'performance', 'now']) expect(violations).toContain(name);
    expect(violations).toContain("globalThis['performance']");
    expect(violations).toContain('document: savedDocument');
    expect(violations).toContain('navigator: savedNavigator');
    expect(violations.filter(name => name === 'document')).toHaveLength(3);
    expect(violations.filter(name => name === 'now')).toHaveLength(2);
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
