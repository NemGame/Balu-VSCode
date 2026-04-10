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
const vscode = __importStar(require("vscode"));
function activate(context) {
    const provider = vscode.languages.registerCompletionItemProvider('balu', {
        provideCompletionItems(document, position) {
            function createdWithStruct(document) {
                let createdStructs = [];
                for (let i = 0; i < document.lineCount; i++) {
                    const lineText = document.lineAt(i).text;
                    const structMatch = lineText.match(/^\s*struct\s+([a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]*)\s*\{/);
                    if (structMatch) {
                        createdStructs.push(structMatch[1]);
                    }
                }
                return createdStructs;
            }
            const createdStructs = createdWithStruct(document);
            const types = ["number", "string", "char", "bool", "byte", "auto", "any", "void", "null"];
            const keywords = ["let", "const", "mut", "struct", "if", "else"];
            // 1. Get the text from the start of the line up to the cursor
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            // 2. CONDITION: Only show types if we just typed a colon ":" 
            // This matches a colon followed by optional spaces
            if (linePrefix.match(/(let|const|mut)\s*[a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]+?/) ||
                linePrefix.match(/:\s*[a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]+?/)) {
                const createdStructs = createdWithStruct(document);
                return [...types, ...createdStructs].map(t => {
                    const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
                    item.detail = "Balu Type";
                    return item;
                });
            }
            if (linePrefix.match(/=\s*[a-zA-Z_\\u0080-\\uFFFF\\$][a-zA-Z0-9_\\u0080-\\uFFFF\\$]+?/)) {
                return [...createdStructs, ...types].map(t => {
                    const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.Struct);
                    item.detail = "Balu Struct";
                    return item;
                });
            }
            if (linePrefix.match(/struct\s*.*/)) {
                return [];
            }
            return [...createdStructs, ...types, ...keywords].map(k => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword));
        }
    }, ':'); // <--- CRITICAL: The ':' tells VS Code to trigger this function immediately when a colon is typed
    context.subscriptions.push(provider);
}
//# sourceMappingURL=extension.js.map