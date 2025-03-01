import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import { ResXDocument } from './ResXEditorProvider';

//#region namespace
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
async function findCSharpNamespace(filePath: vscode.Uri): Promise<string> {
	const csprojFile = await findAssociatedCsprojFile(filePath);
	const rootNamespace = await extractRootNamespace(csprojFile);

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
async function findAssociatedCsprojFile(filePath: vscode.Uri): Promise<vscode.Uri> {
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

	throw new Error('Failed to find .csproj file at parent directory');
}

/** Extracts the root namespace from a .csproj file */
async function extractRootNamespace(csprojPath: vscode.Uri): Promise<string> {
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
		throw new Error(`Failed to parse .csproj file: ${error}`);
	}
}
//#endregion

//#region generate
/**
 * Generate resource designer file
 *
 * @param input Resx/resw file path
 * @param output Output resource designer file path
 */
async function generate(input: vscode.Uri): Promise<void> {
	const output = input.with({ path: input.path.replace(/res[xw]$/, 'Designer.cs') });
	const resxData = (await ResXDocument.fromUri(input)).parse();
	vscode.workspace.fs.writeFile(
		output,
		new TextEncoder().encode(`\uFEFF//------------------------------------------------------------------------------
// <auto-generated>
//     This code was generated by a tool.
//     Runtime Version:4.0.30319.42000
//
//     Changes to this file may cause incorrect behavior and will be lost if
//     the code is regenerated.
// </auto-generated>
//------------------------------------------------------------------------------

namespace ${await findCSharpNamespace(input)} {
    using System;
    
    
    /// <summary>
    ///   A strongly-typed resource class, for looking up localized strings, etc.
    /// </summary>
    // This class was auto-generated by the StronglyTypedResourceBuilder
    // class via a tool like ResGen or Visual Studio.
    // To add or remove a member, edit your .ResX file then rerun ResGen
    // with the /str option, or rebuild your VS project.
    [global::System.CodeDom.Compiler.GeneratedCodeAttribute("System.Resources.Tools.StronglyTypedResourceBuilder", "17.0.0.0")]
    [global::System.Diagnostics.DebuggerNonUserCodeAttribute()]
    [global::System.Runtime.CompilerServices.CompilerGeneratedAttribute()]
    internal class Resources {
        
        private static global::System.Resources.ResourceManager resourceMan;
        
        private static global::System.Globalization.CultureInfo resourceCulture;
        
        [global::System.Diagnostics.CodeAnalysis.SuppressMessageAttribute("Microsoft.Performance", "CA1811:AvoidUncalledPrivateCode")]
        internal Resources() {
        }
        
        /// <summary>
        ///   Returns the cached ResourceManager instance used by this class.
        /// </summary>
        [global::System.ComponentModel.EditorBrowsableAttribute(global::System.ComponentModel.EditorBrowsableState.Advanced)]
        internal static global::System.Resources.ResourceManager ResourceManager {
            get {
                if (object.ReferenceEquals(resourceMan, null)) {
                    global::System.Resources.ResourceManager temp = new global::System.Resources.ResourceManager("Community.PowerToys.Run.Plugin.SSH.Properties.Resources", typeof(Resources).Assembly);
                    resourceMan = temp;
                }
                return resourceMan;
            }
        }
        
        /// <summary>
        ///   Overrides the current thread's CurrentUICulture property for all
        ///   resource lookups using this strongly typed resource class.
        /// </summary>
        [global::System.ComponentModel.EditorBrowsableAttribute(global::System.ComponentModel.EditorBrowsableState.Advanced)]
        internal static global::System.Globalization.CultureInfo Culture {
            get {
                return resourceCulture;
            }
            set {
                resourceCulture = value;
            }
        }${resxData.map((e) => formatOutput(e['@_name'], e.value)).join('')}
    }
}
`),
	);
}

function formatOutput(name: string, value: string): string {
	return `
        
        /// <summary>
        ///   Looks up a localized string similar to ${value}.
        /// </summary>
        internal static string ${name} {
            get {
                return ResourceManager.GetString("${name}", resourceCulture);
            }
        }`;
}
//#endregion

export { generate };
