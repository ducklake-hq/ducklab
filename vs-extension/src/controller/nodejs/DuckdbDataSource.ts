import {
  SqlTranslator,
  ITableInfo,
  IFieldInfo,
  ICalculatedColumn,
  ITabularResultSet,
  IFetchQuery,
  TabularDataSource,
  type ITabularExecuteOpts,
} from '@ducklab/core';
import { DuckDBConnection, DuckDBInstance, DuckDBMaterializedResult, DuckDBType, DuckDBTypeId } from "@duckdb/node-api";


// polyfill
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export class DuckdbDataSource extends TabularDataSource {
  private _tr: SqlTranslator;
  public readonly opts: Required<DuckOptions>;
  private _db: DuckDBConnection | null = null;

  constructor(name: string, duckOpts: DuckOptions) {
    super(name);
    this._tr = new SqlTranslator();
    this.opts = {
      batchSize: 10000,
      previewLimit: 1000,
      rawLimit: -1,
      extensions: [],
      dbPath: "./temp_duckdb.db",
      dataSearchPath: "./data/",
      ...duckOpts,
    };
  }

  public async _init() {
    const db = await (await DuckDBInstance.create(this.opts.dbPath)).connect();
    await db.run(`set file_search_path='${this.opts.dataSearchPath}';`);
    console.log("Init duckdb: ", db);
    return db;
  }

  public async test(): Promise<void> {
    if (!this._db) {
      await this.connect();
      return;
    }
    await this.queryNative('SELECT 1');
  }

  public async connect(): Promise<void> {
    if (!this._db) {
      this._db = await this._init();
    }
    await this.test();
  }

  public async loadExtensions(): Promise<void> {
    for (const ext of this.opts.extensions ?? []) {
      const res = await this.queryNative(`INSTALL ${ext}\nLOAD ${ext}`);
      console.log(`Loaded: ${ext}`, res);
    }
  }

  private async executeNative(query: string): Promise<ITabularResultSet> {
    if (!this._db) {
      await this.connect();
    }
    if (!this._db) {
      throw Error("Database could not be initialized");
    }
    const res = await this._db.run(query);
    if (res.rowCount === 0) {
      return {
        columns: [],
        values: []
      };
    }
    else {
      const transformed = await this.transformResultset(res);
      return transformed;
    }

  }

  public async reset() {
  }


  getJsonType(type: DuckDBType) {
    if ([DuckDBTypeId.INTEGER, DuckDBTypeId.FLOAT, DuckDBTypeId.DOUBLE, DuckDBTypeId.DECIMAL].includes(type.typeId)) return "number";
    if ([DuckDBTypeId.BOOLEAN, DuckDBTypeId.BIT].includes(type.typeId)) return "boolean";
    if ([
      DuckDBTypeId.TIMESTAMP,
      DuckDBTypeId.TIMESTAMP_TZ,
      DuckDBTypeId.TIMESTAMP_NS,
      DuckDBTypeId.TIMESTAMP_S,
      DuckDBTypeId.TIMESTAMP_MS
    ].includes(type.typeId)) return "datetime";
    return "string";
  }

  private async transformResultset(resultset: DuckDBMaterializedResult): Promise<ITabularResultSet> {
    let items: any[] = [];
    const columns: IFieldInfo[] = [];
    const columnNames = resultset.columnNames();
    const columnTypes = resultset.columnTypes();
    for (const i in columnNames) {
      columns.push({
        name: columnNames[i],
        type: this.getJsonType(columnTypes[i]),
      });
    }
    items = await resultset.getRowObjectsJS();
    items = items.map((item, index) => ({ _index: index, ...item }));
    return {
      columns: columns,
      values: items,
    };
  }

  private addLimit(rawQuery: string, limit: number, offset: number) {
    rawQuery = rawQuery.trim();
    if (rawQuery.endsWith(';')) {
      rawQuery = rawQuery.substring(0, rawQuery.length - 1);
    }
    return `select * from (${rawQuery}) offset ${offset} limit ${limit};`;
  }

  public async createView(name: string, query: IFetchQuery) {
    const sql = this._tr.translate(query);
    await this.queryNative(`CREATE OR REPLACE VIEW '${name}' AS (${sql})`);
  }

  public async queryNative(query: string, limit?: number) {
    const result = await this.executeNative(query);
    if (limit != null && limit >= 0 && result.values.length >= limit) {
      result.values = result.values.slice(0, limit);
    }
    return {
      columns: result.columns,
      values: result.values
    };
  }

  public async query(params: ITabularExecuteOpts, limit?: number, offset?: number) {
    if (!offset) offset = 0;
    if (params.rawQuery != null) {
      return await this.queryNative(params.rawQuery, limit ?? this.opts.rawLimit);
    }
    if (!params.query) {
      throw Error("Query must be provided");
    }
    const sql = this._tr.translate(params.query, limit ?? this.opts.previewLimit, offset);
    return await this.queryNative(sql);
  }

  public async getDatasets(): Promise<ITableInfo[]> {
    const results = await this.queryNative(`
        SELECT TABLE_SCHEMA as "schema",
        TABLE_NAME as "table",
        COLUMN_NAME as "column",
        COLUMN_DEFAULT as "default",
        DATA_TYPE as "type",
        CHARACTER_MAXIMUM_LENGTH as max_len
        from INFORMATION_SCHEMA.COLUMNS
        where TABLE_SCHEMA not in ('pg_catalog', 'temp');
        `);
    return this.createDatasets(results);
  }

  protected createDatasets(data: ITabularResultSet): ITableInfo[] {
    const infos: { [key: string]: ITableInfo; } = {};
    for (const col of data.values) {
      if (!(col.table in infos)) {
        infos[col.table] = {
          name: col.table,
          type: 'duckdb',
          namespace: [col.schema],
          schema: [] as IFieldInfo[],
          query: {
            fields: [{ expression: "*" } as ICalculatedColumn],
            from: { name: col.name, namespace: col.schema }
          },
        };
      }
      infos[col.table].schema.push({
        name: col.column,
        type: col.type,
        default: col.default,
        maxSize: col.max_len,
      });
    }
    return Object.values(infos);
  }

  dispose() {
    this._db?.closeSync();
  }
}

export interface DuckOptions {
  batchSize?: number;
  extensions?: string[];
  previewLimit?: number;
  rawLimit?: number;
  dbPath?: string;
  dataSearchPath: string;
}
