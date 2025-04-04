const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Coder Typer is now active.');

    // Show notification that extension is active
    vscode.window.showInformationMessage('Coder Typer is now active.');

    // Add a small delay before processing to handle fast typing
    let timeout = null;
    
    // Create a type subscription for handling typed characters
    let disposable = vscode.workspace.onDidChangeTextDocument(event => {
        // Only process if content changes exist
        if (event.contentChanges.length === 0) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Only process if this is the active editor
        if (editor.document !== event.document) return;

        // Clear any existing timeout
        if (timeout) {
            clearTimeout(timeout);
        }

        // Set a small timeout to allow for consecutive key presses
        timeout = setTimeout(() => {
            processDocument(editor);
        }, 100); // 100ms delay
    });

    // Process the entire document against the reference file
    function processDocument(editor) {
        // Get the current file path
        const currentFilePath = editor.document.uri.fsPath;

        // Get the reference directory from settings
        const config = vscode.workspace.getConfiguration('coderTyper');
        const referenceDir = config.get('referenceDirectory', '');
        
        if (!referenceDir) {
            // No reference directory set, use default behavior with .ref extension
            const defaultReferencePath = currentFilePath + '.ref';
            processReferenceFile(editor, defaultReferencePath);
            return;
        }
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Cannot determine workspace folder for the current file.');
            return;
        }
        
        // Get the relative path of the current file to the workspace root
        const relativePath = path.relative(workspaceFolder.uri.fsPath, currentFilePath);
        
        // Construct the reference file path within the specified directory
        let referenceFilePath;
        if (path.isAbsolute(referenceDir)) {
            // If absolute path is provided
            referenceFilePath = path.join(referenceDir, relativePath);
        } else {
            // If relative path is provided (relative to workspace)
            referenceFilePath = path.join(workspaceFolder.uri.fsPath, referenceDir, relativePath);
        }
        
        processReferenceFile(editor, referenceFilePath);
    }
    
    // Process the document with the given reference file path
    function processReferenceFile(editor, referenceFilePath) {
        // Check if reference file exists
        fs.access(referenceFilePath, fs.constants.F_OK, (err) => {
            if (err) {
                // Reference file doesn't exist, do nothing
                return;
            }

            // Reference file exists, read it
            fs.readFile(referenceFilePath, 'utf8', (err, referenceContent) => {
                if (err) {
                    vscode.window.showErrorMessage(`Error reading reference file: ${err.message}`);
                    return;
                }

                // Get current document content
                const currentContent = editor.document.getText();
                
                // Create a new string to hold the corrected content
                let correctedContent = '';
                
                // Determine the length to process (min of both files to only check typed characters)
                const lengthToProcess = Math.min(currentContent.length, referenceContent.length);
                
                // Process each character that has been typed
                for (let i = 0; i < lengthToProcess; i++) {
                    if (currentContent[i] !== referenceContent[i]) {
                        // Use reference character when different
                        correctedContent += referenceContent[i];
                    } else {
                        // Keep original character when same
                        correctedContent += currentContent[i];
                    }
                }
                
                // If current file is longer than what we've processed, keep the extra content
                if (currentContent.length > lengthToProcess) {
                    correctedContent += currentContent.substring(lengthToProcess);
                }
                
                // Only update if there are differences
                if (correctedContent !== currentContent) {
                    const fullRange = new vscode.Range(
                        editor.document.positionAt(0),
                        editor.document.positionAt(currentContent.length)
                    );
                    
                    editor.edit(editBuilder => {
                        editBuilder.replace(fullRange, correctedContent);
                    }).then(success => {
                        if (!success) {
                            console.error("Failed to replace text");
                        }
                    });
                }
            });
        });
    }

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
