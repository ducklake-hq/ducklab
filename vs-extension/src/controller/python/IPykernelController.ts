
import * as vscode from "vscode";
import { DuckdbDataSource } from '../nodejs/DuckdbDataSource';
import { IFieldInfo, ITabularResultSet } from '@ducklab/core';
import { PythonExtension } from '@vscode/python-extension';
import { IKernelSpec as IKernelSpec, KernelType } from './IKernelSpec';
import { KernelManager } from './KernelManager';

export class IPykernelController {

    readonly id = 'ipykernel-controller';
    readonly notebookType = 'ipykernel';
    readonly supportedLanguages = ['sql', 'markdown', 'plaintext', 'python'];
    readonly label: string = 'Select Kernel';
    readonly description?: string | undefined;
    readonly detail?: string | undefined;
    readonly supportsExecutionOrder?: boolean | undefined;

    onDidChangeSelectedNotebooks: vscode.Event<{ readonly notebook: vscode.NotebookDocument; readonly selected: boolean; }>;

    private readonly _controller: vscode.NotebookController;
    private _executionOrder = 0;

    ds: DuckdbDataSource;

    constructor({ }) {
        console.log("Kernel Picker");

        this._controller = vscode.notebooks.createNotebookController(
            this.id,
            'isql',
            crypto.randomUUID().toString()
        );

        this._controller.supportedLanguages = this.supportedLanguages;
        this._controller.supportsExecutionOrder = true;

        this.onDidChangeSelectedNotebooks = this._controller.onDidChangeSelectedNotebooks;
        // vscode.commands.getCommands(false).then(res => {
        //     console.log("Commands: ", res);
        //     vscode.workspace.fs.writeFile(vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, "./commands.json"),
        //         new TextEncoder().encode(JSON.stringify(res))
        //     );
        // });
        vscode.commands.registerCommand("ducklab.listKernels", () => this.kernelSelection());
    }

    public getInnerController() {
        return this._controller.id;
    }

    async executeHandler(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) {
        // await vscode.commands.executeCommand('notebook.selectKernel', {
        //     notebookEditor,
        //     id,
        //     extension: JVSC_EXTENSION_ID
        // });
        console.log("Controller: ", controller, Object.keys(controller));
        console.log("Inner Controller: ", (controller as any).getInnerController());
        for (const cell of cells) {
            this._doExecution(cell);
        }
    }

    dispose(): void {
        this.ds.dispose();
    }

    async listKernels() {
        let api = await PythonExtension.api();
        await api.ready;
        await api.environments.refreshEnvironments();
        console.log(api.environments.known);
        let kernels: IKernelSpec[] = api.environments.known.map(env => {
            return {
                id: env.id,
                label: `${env.environment.name} (${env.version.major}.${env.version.minor})`,
                envType: env.environment.type,
                type: KernelType.IPYKERNEL,
                path: env.path,
                version: env.version
            };
        });
        console.log(kernels);
        return kernels;
    }

    async kernelSelection() {
        let kernels = await this.listKernels();
        let selectedKernel = await this.requestPickup<IKernelSpec>(kernels);
        await this.launchKernel(selectedKernel);
    }

    async requestPickup<T extends vscode.QuickPickItem>(items: T[]) {
        let selection = await vscode.window.showQuickPick<T>(items,
            {
                canPickMany: false,
                placeHolder: "Select Python Kernel"
            });
        return selection;
    }

    async launchKernel(kernelSpec: IKernelSpec) {
        let kernelManager = new KernelManager();
        let kernel = await kernelManager.launchKernel(kernelSpec);
        setTimeout(() => {
            kernel.execute("print('Message from python')");
        }, 15000);
    }

    // async selectKernel() {
    //     let activeTab: any = vscode.window.tabGroups.activeTabGroup.activeTab.input;
    //     if (!activeTab) {
    //         console.log("No active tab");
    //         return;
    //     };
    //     console.log("window: ", activeTab.uri);
    //     const uri = activeTab.uri;
    //     const notebookEditor =
    //         vscode.window.activeNotebookEditor?.notebook?.uri?.toString() === uri.toString()
    //             ? vscode.window.activeNotebookEditor
    //             : await vscode.window.showNotebookDocument(await vscode.workspace.openNotebookDocument(uri));
    //     // vscode.commands.executeCommand("notebook.selectKernel", {
    //     //     notebookEditor,
    //     // }).then(res => {
    //     //     console.log("Select kernel res: ", typeof (res), res);
    //     // });
    //     let kernels = this.getKernelNotebook(notebookEditor.notebook);
    //     console.log("Found kernels: ", kernels);
    // }

    // async getKernelNotebook(document: vscode.NotebookDocument): Promise<Kernel | undefined> {
    //     const extension = vscode.extensions.getExtension<Jupyter>('ms-toolsai.jupyter');
    //     if (!extension) {
    //         vscode.window.showErrorMessage('Reactive Jupyter: Jupyter extension not installed');
    //         throw new Error('Reactive Jupyter: Jupyter extension not installed');
    //     }
    //     if (!extension.isActive) { await extension.activate(); }
    //     const api = extension.exports;
    //     console.log("JupyterApi: ", extension.exports);
    //     return new Promise<Kernel | undefined>(async (resolve) => {
    //         const kernel = await api.kernels.getKernel(document.uri);
    //         console.log("FoundKernel: ", kernel);
    //         if (kernel && (kernel as any).language === 'python') { resolve(kernel); } else { resolve(undefined); }
    //     });
    // }

    private getRow(cols: IFieldInfo[], obj: any) {
        let row = "";
        for (let k of cols) {
            row += `<td>${obj[k.name]}</td>`;
        }
        return `<tr>${row}</tr>`;
    }

    private getEllipsesRow(results: ITabularResultSet) {
        let row = {};
        for (let col of results.columns) {
            row[col.name] = "...";
        }
        return row;
    }

    private renderTable(results: ITabularResultSet): string {
        let values = results.values;
        if (results.values.length > 50) {
            values = results.values.slice(0, 5);
            values.push(this.getEllipsesRow(results));
            values = values.concat(results.values.slice(results.values.length - 5));
        }
        let text = `<table class="ducklab-table">
        <thead><tr>${results.columns.map(c => '<th>' + c.name + '</th>').join("\n")}</tr></thead>
        <tbody>${values.map(row => this.getRow(results.columns, row)).join("\n")}</tbody>
        </table>
        <style>
        // .ducklab-table thead, .ducklab-table tbody {
        //     display: block;
        // }
        // .ducklab-table tbody {
        //     height: 100px;
        //     overflow: auto;
        // }
        </style>
        `;
        return text;
    }

    private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
        execution.start(Date.now()); // Keep track of elapsed time to execute cell.

        try {
            const results = await this.ds.queryNative(cell.document.getText());
            console.log("results: ", results);

            let text = this.renderTable(results);

            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(text, "text/html")
                ])
            ]);
            execution.end(true, Date.now());
        }

        catch (e) {
            console.log("Exception during execution: ", e);
            execution.replaceOutput(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.error(new Error(e.message))
            ]));
            execution.end(false, Date.now());
        }
    }
}