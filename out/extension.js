"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
/**
 * Helper to find structs in the document.
 * Moved outside activate to avoid re-defining it on every completion request.
 */
function getCreatedStructs(document) {
    const createdStructs = [];
    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        // Fixed regex unicode ranges (removed extra backslashes)
        const structMatch = lineText.match(/^\s*struct\s+([a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*)\s*\{/);
        if (structMatch) {
            createdStructs.push(structMatch[1]);
        }
    }
    return createdStructs;
}
function parseComments(line, inBlockComment) {
    const commentRanges = [];
    let blockStart = inBlockComment ? 0 : -1;
    let stringChar = null;
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1] || '';
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (inBlockComment) {
            if (char === '*' && next === '/') {
                commentRanges.push({ start: blockStart, end: i + 2 });
                inBlockComment = false;
                blockStart = -1;
                i++; // Skip '/'
            }
        }
        else if (stringChar) {
            if (char === stringChar)
                stringChar = null;
        }
        else if (char === '/' && next === '*') {
            inBlockComment = true;
            blockStart = i;
            i++; // Skip '*'
        }
        else if (char === '/' && next === '/') {
            commentRanges.push({ start: i, end: line.length });
            return { commentRanges, currentlyInBlock: false };
        }
        else if (char === '"' || char === "'") {
            stringChar = char;
        }
    }
    if (inBlockComment) {
        commentRanges.push({ start: blockStart, end: line.length });
    }
    return { commentRanges, currentlyInBlock: inBlockComment };
}
/**
 * Scans the document for errors and updates the diagnostic collection.
 */
function refreshDiagnostics(document, collection) {
    if (document.languageId !== 'balu') {
        return;
    }
    const diagnostics = [];
    const builtInTypes = ["number", "string", "char", "bool", "byte", "auto", "any", "void", "null"];
    let isCommentBlock = false;
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        // Handle block comments to avoid false positives
        const { commentRanges, currentlyInBlock } = parseComments(line.text, isCommentBlock);
        isCommentBlock = currentlyInBlock;
        // 1. Detect multi-character char literals: 'abc'
        const charRegex = /'([^']{2,})'/g;
        let match;
        while ((match = charRegex.exec(line.text)) !== null) {
            const matchIndex = match.index;
            if (!commentRanges.some(r => matchIndex >= r.start && matchIndex < r.end)) {
                const range = new vscode.Range(i, match.index, i, match.index + match[0].length);
                diagnostics.push(new vscode.Diagnostic(range, "Character literals must contain exactly one character.", vscode.DiagnosticSeverity.Error));
            }
        }
        // 2. Detect redefinition of built-in types: struct string { ... }
        const structRegex = /^\s*struct\s+([a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*)/;
        const structMatch = structRegex.exec(line.text);
        if (structMatch !== null) {
            const identifier = structMatch[1];
            const startPos = structMatch.index + structMatch[0].indexOf(identifier);
            if (!commentRanges.some(r => startPos >= r.start && startPos < r.end) && builtInTypes.includes(identifier)) {
                const range = new vscode.Range(i, startPos, i, startPos + identifier.length);
                diagnostics.push(new vscode.Diagnostic(range, `Cannot use built-in type name '${identifier}' as a struct identifier.`, vscode.DiagnosticSeverity.Error));
            }
        }
        // 3. char declared with double quotes: char c = "a";
        const charDeclRegex = /\b((let|const|mut)\s+)?char\s+[a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*\s*=\s*"([^"]*)"/g;
        const charDeclRegex2 = /\b(let|const|mut)\s+[a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*\s*(:\s*[a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*)?\s*=\s*"([^"]*)"/g;
        while ((match = charDeclRegex.exec(line.text)) !== null || (match = charDeclRegex2.exec(line.text)) !== null) {
            const matchIndex = match.index + match[0].indexOf(match[1]);
            if (!commentRanges.some(r => matchIndex >= r.start && matchIndex < r.end)) {
                const range = new vscode.Range(i, match.index, i, match.index + match[0].length);
                diagnostics.push(new vscode.Diagnostic(range, "Character literals must use single quotes, not double quotes.", vscode.DiagnosticSeverity.Error));
            }
        }
    }
    collection.set(document.uri, diagnostics);
}
function activate(context) {
    const hoverProvider = vscode.languages.registerHoverProvider('balu', {
        provideHover(document, position, token) {
            // Use a regex to ensure we only grab the word, ignoring punctuation
            const range = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
            if (!range) {
                return undefined;
            }
            const word = document.getText(range);
            const lineText = document.lineAt(position.line).text;
            // More specific check: is 'nameof' followed by a space/identifier THEN an equals?
            // This helps distinguish 'nameof x = "y"' from 'let s = nameof(x)'
            const isAssignment = document.getWordRangeAtPosition(position, new RegExp(`\\b${word}\\b\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*=`)) !== undefined;
            if (word === 'nameof') {
                const contents = new vscode.MarkdownString();
                contents.appendMarkdown('**nameof**\n\n');
                if (isAssignment) {
                    contents.appendMarkdown('Used here to assign a new name to a symbol at compile-time.');
                }
                else {
                    contents.appendMarkdown('Returns the name of the symbol as a `string` literal.');
                }
                return new vscode.Hover(contents);
            }
            if (word === 'typeof') {
                const title = isAssignment ?
                    "typeof varName = typeName" :
                    "typeof(expression)";
                const message = isAssignment ?
                    "Reassigns the type of the variable" :
                    "Returns the type of an expression";
                return new vscode.Hover(new vscode.MarkdownString(`**${title}**\n\n${message}`));
            }
            return undefined;
        }
    });
    context.subscriptions.push(hoverProvider);
    const provider = vscode.languages.registerCompletionItemProvider('balu', {
        provideCompletionItems(document, position) {
            const nameof_ = new vscode.CompletionItem('nameof', vscode.CompletionItemKind.Keyword);
            nameof_.documentation = new vscode.MarkdownString("`nameof varName = \"newName\"`\n\nAssigns a new name to a symbol at compile-time. The assigned name must be a string literal. " +
                "This is useful for cases where you want to give a symbol a different name in the compiled output, such as for interop with other " +
                "languages or to avoid naming conflicts." +
                "\n\n`nameof(varName)`\n\nReturns the name of the symbol as a `string` literal. " +
                "This can be used for debugging, logging, or any situation where you want to get the name of a variable, function, or type as a string.");
            nameof_.detail = ">";
            const structs = getCreatedStructs(document).map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.Struct));
            const types = ["number", "string", "char", "bool", "byte", "auto", "any", "void", "null"].map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter));
            let keywords = ["let", "const", "mut", "alias", "struct", "if", "else"].map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.Keyword));
            keywords.push(nameof_);
            const values = ["true", "false", "null"].map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.Value));
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            if (linePrefix.match(/(let|const|mut)\s*[a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*/) ||
                linePrefix.match(/:\s*[a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*$/)) {
                return [...structs, ...types];
            }
            if (linePrefix.match(/=\s*[a-zA-Z_\u0080-\uFFFF\$][a-zA-Z0-9_\u0080-\uFFFF\$]*$/)) {
                return [...structs, ...types, ...values];
            }
            if (linePrefix.match(/struct\s*.*/)) {
                return [];
            }
            return [...structs, ...types, ...keywords, ...values];
        }
    }, ':'); // <--- CRITICAL: The ':' tells VS Code to trigger this function immediately when a colon is typed
    context.subscriptions.push(provider);
    // Create and register the diagnostic collection
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('balu');
    context.subscriptions.push(diagnosticCollection);
    // Perform initial scan of the active document
    if (vscode.window.activeTextEditor) {
        refreshDiagnostics(vscode.window.activeTextEditor.document, diagnosticCollection);
    }
    // Update diagnostics whenever the document is opened or changed
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => refreshDiagnostics(doc, diagnosticCollection)));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => refreshDiagnostics(e.document, diagnosticCollection)));
    // Clear diagnostics when a document is closed
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri)));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map