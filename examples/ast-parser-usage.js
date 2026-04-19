"use strict";
/**
 * Example usage of ASTParser
 *
 * This demonstrates how to use the ASTParser class to analyze
 * TypeScript/JavaScript files and extract structural information.
 */
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
const ASTParser_1 = require("../src/parsers/ASTParser");
const path = __importStar(require("path"));
async function main() {
    // Initialize parser with project root directory
    const projectRoot = path.join(__dirname, '..');
    const parser = new ASTParser_1.ASTParser(projectRoot);
    // Parse a file
    const filePath = 'src/core/FileDiscovery.ts';
    console.log(`\nParsing: ${filePath}\n`);
    const result = await parser.parse(filePath);
    // Display imports
    console.log('=== IMPORTS ===');
    result.imports.forEach((imp) => {
        const type = imp.isExternal ? '[EXTERNAL]' : '[INTERNAL]';
        console.log(`${type} ${imp.source}`);
        if (imp.specifiers.length > 0) {
            console.log(`  Imports: ${imp.specifiers.join(', ')}`);
        }
    });
    // Display exports
    console.log('\n=== EXPORTS ===');
    result.exports.forEach((exp) => {
        const defaultTag = exp.isDefault ? '[DEFAULT]' : '';
        console.log(`${exp.type.toUpperCase()}: ${exp.name} ${defaultTag}`);
    });
    // Display metadata
    console.log('\n=== METADATA ===');
    console.log(`Has Default Export: ${result.metadata.hasDefaultExport}`);
    console.log(`Is React Component: ${result.metadata.isReactComponent}`);
    console.log(`Is API Route: ${result.metadata.isApiRoute}`);
    // Display external calls (will be empty for now, implemented in Phase 3)
    console.log('\n=== EXTERNAL CALLS ===');
    if (result.externalCalls.length === 0) {
        console.log('(None detected - full implementation in Phase 3)');
    }
    else {
        result.externalCalls.forEach((call) => {
            console.log(`${call.type}: ${call.target} at line ${call.location.line}`);
        });
    }
}
// Run the example
main().catch(console.error);
//# sourceMappingURL=ast-parser-usage.js.map