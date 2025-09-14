
import * as vscode from "vscode";
import { IFieldInfo, ITabularResultSet } from '@ducklab/core';
import { IRunningKernel } from '../IRunningKernel';
import { MessageType, OutputMessage } from '../messaging';
import { IDisposable } from '@/disposable';
import { TypedEmitter } from '../TypedEmitter';
import { KernelSelector } from '../vs/KernelSelector';
import path from 'path';
import { IControllerOpts } from '../IControllerOpts';
import { getResourceId } from '../utils';


export class DucklabPythonController implements IDisposable {

    readonly id = 'ducklab';
    readonly notebookType = 'isql';
    readonly supportedLanguages = ['sql', 'markdown', 'plaintext', 'python'];
    readonly label: string = 'Python/SQL';
    readonly description?: string | undefined;
    readonly detail?: string | undefined;
    readonly supportsExecutionOrder = true;

    onDidChangeSelectedNotebooks: vscode.Event<{ readonly notebook: vscode.NotebookDocument; readonly selected: boolean; }>;

    public readonly opts: IControllerOpts;
    private readonly _controller: vscode.NotebookController;
    private _executionOrder = 0;
    private kSelector = new KernelSelector();

    constructor(opts: IControllerOpts) {

        this.opts = opts;

        try {
            this._controller = vscode.notebooks.createNotebookController(this.id,
                this.notebookType,
                this.label);

            this._controller.interruptHandler = this.interruptHandler.bind(this);
            this._controller.executeHandler = this.executeHandler.bind(this);
            this._controller.supportsExecutionOrder = this.supportsExecutionOrder;
            this._controller.supportedLanguages = this.supportedLanguages;

            this._controller.onDidChangeSelectedNotebooks(({ notebook, selected }) => {
                console.log("NotebookSelection: ", selected, notebook);
            });

            vscode.workspace.onDidCloseNotebookDocument(nb => this.onNotebookClose(nb));

            // json stringify to escape the string
            this.kSelector.init(`
                import duckdb
                db = duckdb.connect(r'${path.join(opts.tempPath, this.id)}.duckdb')
                db.execute('set file_search_path=${JSON.stringify(opts.workingDir)};')
            `, 60000);
        }
        catch (e) {
            console.log(e);
        }
    }

    private onNotebookClose(notebook: vscode.NotebookDocument) {
        this.kSelector.killAttachedKernel(notebook);
        console.log("Disposed: ", notebook.uri.fsPath);
    }

    async interruptHandler(notebook) {
        console.log("Interrupting: ", notebook.uri);

        let kernel = await this.kSelector.getAttachedKernel(notebook);
        if (!kernel) return;
        await kernel.interrupt();
    }

    async executeHandler(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) {
        console.log("Execute: ", notebook);
        try {
            let kernel = await this.kSelector.resolveKernel(notebook);
            for (let cell of cells) {
                await this._doExecution(cell, kernel);
            }
        }
        catch (err) {
            console.log("Failed: ", err);
        }
    }

    dispose(): void {
        this._controller.dispose();
        this.kSelector.dispose();
    }

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

    private async _doExecution(cell: vscode.NotebookCell, kernel: IRunningKernel): Promise<void> {
        let failed = false;
        let currExecution = this._controller.createNotebookCellExecution(cell);

        currExecution.executionOrder = ++this._executionOrder;
        currExecution.start(Date.now()); // Keep track of elapsed time to execute cell.
        await currExecution.clearOutput();
        let output = new vscode.NotebookCellOutput([]);
        await currExecution.replaceOutput(output);

        try {
            let resEmitter: TypedEmitter<any> = null;
            if (cell.document.languageId.toLowerCase() === "python") {
                resEmitter = await kernel.execute(cell.document.getText());
            }
            if (cell.document.languageId.toLowerCase() === "sql") {
                resEmitter = await kernel.execute(`db.query("""${cell.document.getText()}""")`);
            }
            resEmitter.on(async (event) => {
                console.log("Result: ", cell.index, event.msgType, event.content);
                if (event.msgType === MessageType.Output) {
                    const msg = (event as OutputMessage);

                    if (msg.content.contentType === "text/html") {
                        await currExecution.appendOutput(new vscode.NotebookCellOutput([
                            vscode.NotebookCellOutputItem.text(msg.content.data, msg.content.contentType)
                        ]));
                    }
                    else {
                        await currExecution.appendOutputItems([
                            vscode.NotebookCellOutputItem.stdout(msg.content.data)
                        ], output);
                    }
                }
                if (event.msgType === MessageType.Error) {
                    console.log("Error: ", event);
                    failed = true;
                    await currExecution.appendOutput(new vscode.NotebookCellOutput([
                        vscode.NotebookCellOutputItem.stderr(event.content.traceback)
                    ]));
                }
            });
            resEmitter.onDispose(code => {
                if (code !== 0) failed = true;
                console.log("Response emitter Disposed: ", cell.index);
                currExecution.end(!failed, Date.now());
            });
        }

        catch (e) {
            console.log("Exception during execution: ", e);
            currExecution.end(false, Date.now());
        }
    }
}