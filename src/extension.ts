import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerCompletionItemProvider('balu', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

            function createdWithStruct(document: vscode.TextDocument): string[] {
                let createdStructs: string[] = [];
                for (let i = 0; i < document.lineCount; i++) {
                    const lineText = document.lineAt(i).text;
                    const structMatch = lineText.match(/^\s*struct\s+([a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]*)\s*\{/);
                    if (structMatch) {
                        createdStructs.push(structMatch[1]);
                    }
                }
                return createdStructs;
            }

            const createdStructs: vscode.CompletionItem[] = createdWithStruct(document).map(t => {
                const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.Struct);
                item.detail = "Balu Struct";
                return item;
            });
            const types = ["number", "string", "char", "bool", "byte", "auto", "any", "void", "null"].map(t => {
                const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
                item.detail = "Balu Type";
                return item;
            });
            const keywords = ["let", "const", "mut", "struct", "if", "else"].map(t => {
                const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.Keyword);
                item.detail = "Balu Keyword";
                return item;
            });
            const values = ["true", "false", "null"].map(t => {
                const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.Value);
                item.detail = "Balu Value";
                return item;
            });

            const linePrefix = document.lineAt(position).text.substr(0, position.character);

            if (linePrefix.match(/(let|const|mut)\s*[a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]+?/) ||
                linePrefix.match(/:\s*[a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]+?/)) {
                return [...createdStructs, ...types];
            }
            if (linePrefix.match(/=\s*[a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]+?/)) {
                return [...createdStructs, ...types, ...values];
            }
            if (linePrefix.match(/struct\s*.*/)) {
                return [];
            }
            return [...createdStructs, ...types, ...keywords, ...values];
        }
    }, ':'); // <--- CRITICAL: The ':' tells VS Code to trigger this function immediately when a colon is typed

    context.subscriptions.push(provider);
}