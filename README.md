# ResX Editor

A visual editor for .resx files  

![screenshot](https://raw.githubusercontent.com/8LWXpg/vscode-resx/refs/heads/master/assets/preview.avif)

## Features

- **Keyboard navigation:**
  
  Move up: <kbd>Ctrl+Up</kbd>
  
  Move down: <kbd>Ctrl+Down</kbd> or <kbd>Ctrl+Enter</kbd>
  
  Move left: <kbd>Shift+Tab</kbd>
  
  Move right: <kbd>Tab</kbd>

- **Sortable table:** click on the column header to sort the rows.
- **Sync with document:** change in document will be reflected in the editor immediately, and vice versa.
- **Small package size:** less than 20KiB.
- **Web extension**: support on the web (vscode.dev, GitHub Codespaces).

## Commands

- `ResX: Create Empty File`
- `ResX: Update Other Resources in Same Folder`
- `Sync with Main Resource in the Same Folder` - also on top right icon, only supports file with name `\.[a-z]{2}(-[A-Z]{2})?\.resx`
