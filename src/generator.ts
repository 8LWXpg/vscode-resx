import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';

/**
 * Finds the C# namespace for a given file path by:
 *
 * 1. Finding the associated .csproj file
 * 2. Extracting the root namespace from the project
 * 3. Adding subdirectory structure as namespace components
 *
 * @param filePath Path to the .cs file to find namespace for
 * @returns The determined namespace string or null if unable to determine
 */
async function findCSharpNamespace(filePath: vscode.Uri): Promise<string | null> {
	const csprojFile = await findAssociatedCsprojFile(filePath);
	if (!csprojFile) {
		return null;
	}

	const rootNamespace = await extractRootNamespace(csprojFile);
	if (!rootNamespace) {
		return null;
	}

	const projectDir = vscode.Uri.joinPath(csprojFile, '..');
	const fileDir = vscode.Uri.joinPath(filePath, '..');
	let relativeDir = fileDir.path.substring(projectDir.path.length + 1);

	let namespaceComponents: string[] = [];
	if (relativeDir !== '') {
		namespaceComponents = relativeDir.split('/');
	}

	// Combine root namespace with subdirectory components
	if (namespaceComponents.length > 0) {
		return `${rootNamespace}.${namespaceComponents.join('.')}`;
	} else {
		return rootNamespace;
	}
}

/** Finds the .csproj file associated with a C# file by searching up the directory tree */
async function findAssociatedCsprojFile(filePath: vscode.Uri): Promise<vscode.Uri | null> {
	const rootDir = vscode.workspace.getWorkspaceFolder(filePath)!.uri;
	for (
		let currentDir = vscode.Uri.joinPath(filePath, '..');
		currentDir !== rootDir;
		currentDir = vscode.Uri.joinPath(currentDir, '..')
	) {
		const files = await vscode.workspace.fs.readDirectory(currentDir);
		const csprojFiles = files.filter((file) => file[0].endsWith('.csproj'));

		if (csprojFiles.length > 0) {
			return vscode.Uri.joinPath(currentDir, csprojFiles[0][0]);
		}
	}

	return null;
}

/** Extracts the root namespace from a .csproj file */
async function extractRootNamespace(csprojPath: vscode.Uri): Promise<string | null> {
	try {
		const fileContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(csprojPath));
		const parser = new XMLParser();
		const result = parser.parse(fileContent);

		if (result.Project && result.Project.PropertyGroup) {
			const propertyGroups = Array.isArray(result.Project.PropertyGroup)
				? result.Project.PropertyGroup
				: [result.Project.PropertyGroup];

			// Option 1: Look for RootNamespace
			for (const group of propertyGroups) {
				if (group.RootNamespace) {
					return group.RootNamespace;
				}
			}

			// Option 2: Look for AssemblyName
			for (const group of propertyGroups) {
				if (group.AssemblyName) {
					return group.AssemblyName;
				}
			}
		}

		// Option 3: Use project file name
		return csprojPath.path.substring(
			vscode.Uri.joinPath(csprojPath, '..').path.length + 1,
			csprojPath.path.length - '.csproj'.length,
		);
	} catch (error) {
		vscode.window.showErrorMessage(`Error parsing .csproj file: ${error}`);

		return null;
	}
}

export { findCSharpNamespace };
