
import * as vscode from "vscode";
import { DuckdbDataSource } from './DuckdbDataSource';
import { IFieldInfo, ITabularResultSet } from '@ducklab/core';
import { IControllerOpts } from '../IControllerOpts';
import path from "path";
import { getResourceId } from '../utils';

export class DucklabSQLController {

    readonly id = 'ducklab-sql';
    readonly notebookType = 'isql';
    readonly supportedLanguages = ['sql', 'markdown', 'plaintext'];
    readonly label: string = 'SQL Only';
    readonly description?: string | undefined;
    readonly detail?: string | undefined;
    readonly supportsExecutionOrder?: boolean | undefined = true;


    public readonly opts: IControllerOpts;
    private readonly _controller: vscode.NotebookController;
    private _executionOrder = 0;
    private kernels: { [id: string]: DuckdbDataSource; } = {};

    constructor(opts: IControllerOpts) {

        this.opts = opts;

        this._controller = vscode.notebooks.createNotebookController(
            this.id,
            'isql',
            this.label
        );

        this._controller.executeHandler = this.executeHandler.bind(this);
        this._controller.supportsExecutionOrder = this.supportsExecutionOrder;
        this._controller.supportedLanguages = this.supportedLanguages;

        vscode.workspace.onDidCloseNotebookDocument(nb => this.onNotebookClose(nb));
    }

    private onNotebookClose(notebook: vscode.NotebookDocument) {
        const nbId = getResourceId(notebook.uri);
        if (nbId in this.kernels) {
            this.kernels[nbId].dispose();
            delete this.kernels[nbId];
            console.log("Disposed: ", nbId);
        }
    }

    private async showNotification(message: string) {

    }


    public async resolveKernel(notebook: vscode.NotebookDocument) {

        const nbId = getResourceId(notebook.uri);

        if (!(nbId in this.kernels)) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Initializing Kernel...",
            }, async (progress) => {
                this.kernels[nbId] = new DuckdbDataSource(nbId, {
                    dataSearchPath: this.opts.workingDir,
                    dbPath: path.join(this.opts.tempPath, "ducklab", nbId + ".db")
                });
                await this.kernels[nbId].connect();
                progress.report({ message: "Loading Default Extensions..." });
                await this.kernels[nbId].loadExtensions();
            });
        }
        return this.kernels[nbId];
    }

    public getInnerController() {
        return this._controller.id;
    }

    async executeHandler(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) {
        const kernel = await this.resolveKernel(notebook);
        for (const cell of cells) {
            this._doExecution(cell, kernel);
        }
    }

    dispose(): void {
        Object.keys(this.kernels).map(k => this.kernels[k].dispose());
    }

    private parseJsType(value: any, column: IFieldInfo) {
        switch (column.type) {
            case "datetime":
                return new Date(value).toISOString();
            default:
                return value;
        }
    }

    private getRow(cols: IFieldInfo[], obj: any) {
        let row = "";
        for (let k of cols) {
            row += `<td>${this.parseJsType(obj[k.name], k)}</td>`;
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

    private async _doExecution(cell: vscode.NotebookCell, kernel: DuckdbDataSource): Promise<void> {
        console.log("Executing...");
        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
        execution.start(Date.now()); // Keep track of elapsed time to execute cell.

        try {
            const results = await kernel.queryNative(cell.document.getText());

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